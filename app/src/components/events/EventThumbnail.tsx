import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { VideoOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import { log, LogLevel } from '../../lib/logger';

const fidIndexCache = new Map<string, number>();

export function __resetThumbnailCache() {
  fidIndexCache.clear();
}

export interface EventThumbnailProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError' | 'onLoad'> {
  urls: string[];
  cacheKey: string;
  alt?: string;
  objectFit?: CSSProperties['objectFit'];
}

export function EventThumbnail({
  urls,
  cacheKey,
  alt,
  className,
  style,
  objectFit,
  ...rest
}: EventThumbnailProps) {
  const safeUrls = Array.isArray(urls) ? urls : [];
  const cachedIndex = fidIndexCache.get(cacheKey) ?? 0;
  const startIndex = cachedIndex < safeUrls.length ? cachedIndex : 0;
  const [index, setIndex] = useState(startIndex);
  const [loaded, setLoaded] = useState(false);
  const [exhausted, setExhausted] = useState(safeUrls.length === 0);
  const lastKeyRef = useRef(cacheKey);

  useEffect(() => {
    if (lastKeyRef.current !== cacheKey) {
      lastKeyRef.current = cacheKey;
      const next = fidIndexCache.get(cacheKey) ?? 0;
      setIndex(next < safeUrls.length ? next : 0);
      setLoaded(false);
      setExhausted(safeUrls.length === 0);
    }
  }, [cacheKey, safeUrls.length]);

  if (exhausted || safeUrls.length === 0) {
    return (
      <div
        className={cn(className, 'flex items-center justify-center bg-muted/30')}
        style={style}
        role="img"
        aria-label={alt}
        data-thumbnail-state="placeholder"
      >
        <VideoOff className="h-6 w-6 text-muted-foreground/40" />
      </div>
    );
  }

  const handleError = () => {
    const nextIndex = index + 1;
    if (nextIndex >= safeUrls.length) {
      log.imageError('Thumbnail chain exhausted', LogLevel.WARN, { cacheKey, attempts: safeUrls.length });
      setExhausted(true);
      return;
    }
    setIndex(nextIndex);
    setLoaded(false);
  };

  const handleLoad = () => {
    fidIndexCache.set(cacheKey, index);
    setLoaded(true);
  };

  return (
    <img
      key={`${cacheKey}-${index}`}
      src={safeUrls[index]}
      alt={alt}
      className={cn(className, 'transition-opacity duration-150')}
      style={{
        ...style,
        objectFit,
        opacity: loaded ? 1 : 0,
      }}
      onError={handleError}
      onLoad={handleLoad}
      data-thumbnail-state={loaded ? 'loaded' : 'loading'}
      data-thumbnail-index={index}
      {...rest}
    />
  );
}
