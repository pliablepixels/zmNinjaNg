/**
 * Collapsible Card Component
 *
 * A Card with a clickable header that collapses/expands the content.
 * Uses Radix Collapsible for accessible expand/collapse behavior.
 */

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card, CardHeader, CardContent } from './card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible';
import { cn } from '../../lib/utils';

interface CollapsibleCardProps {
  /** Header content (icon + title + description) */
  header: React.ReactNode;
  /** Card body content */
  children: React.ReactNode;
  /** Start expanded (default: true) */
  defaultOpen?: boolean;
  /** data-testid for the card */
  'data-testid'?: string;
}

export function CollapsibleCard({
  header,
  children,
  defaultOpen = true,
  ...props
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card data-testid={props['data-testid']}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none">
            <div className="flex items-center justify-between">
              <div className="flex-1">{header}</div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200 flex-shrink-0 ml-2",
                  open && "rotate-180"
                )}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>{children}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
