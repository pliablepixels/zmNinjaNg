/**
 * TypeScript definitions for VideoRTC v1.6.0
 * Video player for go2rtc streaming application
 *
 * Source: https://github.com/AlexxIT/go2rtc
 */

/**
 * VideoRTC Custom Element
 *
 * Supports multiple streaming protocols with automatic fallback:
 * - WebRTC (lowest latency, peer-to-peer)
 * - MSE (Media Source Extensions, H.264/H.265)
 * - HLS (HTTP Live Streaming)
 * - MP4 (Progressive download)
 * - MJPEG (Motion JPEG, highest compatibility)
 */
export class VideoRTC extends HTMLElement {
  // Configuration Properties

  /** Timeout before disconnecting (ms). Default: 5000 */
  DISCONNECT_TIMEOUT: number;

  /** Timeout before reconnecting (ms). Default: 15000 */
  RECONNECT_TIMEOUT: number;

  /** Supported codec list */
  CODECS: string[];

  /**
   * Supported streaming modes (comma-separated).
   * Options: webrtc, webrtc/tcp, mse, hls, mp4, mjpeg
   * Default: 'webrtc,mse,hls,mjpeg'
   */
  mode: string;

  /**
   * Requested media types (comma-separated).
   * Options: video, audio, microphone
   * Default: 'video,audio'
   */
  media: string;

  /** Run stream when not displayed on screen. Default: false */
  background: boolean;

  /**
   * Visibility threshold (0-1) for IntersectionObserver.
   * 0 = disabled, 1 = fully visible required
   * Default: 0
   */
  visibilityThreshold: number;

  /** Pause when browser tab is hidden. Default: true */
  visibilityCheck: boolean;

  /** WebRTC peer connection configuration */
  pcConfig: RTCConfiguration;

  // State Properties

  /** WebSocket connection state (WebSocket.CONNECTING | OPEN | CLOSED) */
  wsState: number;

  /** WebRTC peer connection state */
  pcState: number;

  /** Video element created by VideoRTC */
  video: HTMLVideoElement | null;

  /** WebSocket connection */
  ws: WebSocket | null;

  /** WebSocket URL */
  wsURL: string | URL;

  /** RTCPeerConnection instance */
  pc: RTCPeerConnection | null;

  /** Connection timestamp */
  connectTS: number;

  /** MSE codec string */
  mseCodecs: string;

  /** Disconnect timeout ID */
  disconnectTID: number;

  /** Reconnect timeout ID */
  reconnectTID: number;

  /** Binary data handler */
  ondata: ((data: ArrayBuffer) => void) | null;

  /** JSON message handlers */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- go2rtc vendor library message payload is untyped
  onmessage: Record<string, (message: any) => void> | null;

  // Setters

  /**
   * Set video source (WebSocket URL). Supports relative paths.
   * Format: ws://server:port/api/ws?src=streamname
   */
  src: string | URL;

  // Public Methods

  /**
   * Start video playback.
   * Handles autoplay with muted fallback.
   */
  play(): Promise<void>;

  /**
   * Send JSON message through WebSocket.
   * @param value - Object to send as JSON
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- go2rtc vendor library send accepts arbitrary JSON-serializable values
  send(value: any): void;

  /**
   * Filter codecs based on browser support.
   * @param isSupported - Predicate function to test codec support
   * @returns Filtered codec array
   */
  codecs(isSupported: (codec: string) => boolean): string[];

  // Lifecycle Hooks (can be overridden)

  /**
   * Called when element is added to DOM.
   * Initializes video element and starts connection.
   */
  connectedCallback(): void;

  /**
   * Called when element is removed from DOM.
   * Schedules disconnection with timeout.
   */
  disconnectedCallback(): void;

  /**
   * Initialization hook.
   * Creates video element and sets up observers.
   * Override to customize initialization.
   */
  oninit(): void;

  /**
   * Connection hook.
   * Called when WebSocket connection is established.
   * Override to handle connection events.
   * @returns true if connection should proceed
   */
  onconnect(): boolean;

  /**
   * Disconnection hook.
   * Called when WebSocket is disconnected.
   * Override to handle disconnection events.
   */
  ondisconnect(): void;

  /**
   * WebSocket open hook.
   * Called when WebSocket connection is ready.
   * Override to send initial messages or setup handlers.
   * @returns Array of supported streaming modes
   */
  onopen(): string[];

  /**
   * WebSocket close hook.
   * Called when WebSocket is closed.
   * Override to handle cleanup.
   */
  onclose(): void;

  /**
   * WebRTC video track hook.
   * Called when video track is added to peer connection.
   * Override to handle video stream.
   * @param video - HTMLVideoElement with WebRTC stream
   */
  onpcvideo(video: HTMLVideoElement): void;
}
