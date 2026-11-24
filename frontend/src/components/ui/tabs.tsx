'use client';

import { DirectionProvider } from '@base-ui/react/direction-provider';
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import { cn } from 'cn';

export function Tabs({
  dir = 'ltr',
  ...props
}: TabsPrimitive.Root.Props & { dir?: 'ltr' | 'rtl' }) {
  return (
    <DirectionProvider direction={dir}>
      <TabsPrimitive.Root dir={dir} {...props} />
    </DirectionProvider>
  );
}

export function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      activateOnFocus
      className={cn('flex flex-wrap gap-1 border-b-2 border-primary', className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      type="button"
      className={cn(
        'min-h-11 cursor-pointer rounded-t-md border border-b-0 border-input bg-card px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-selected:border-primary aria-selected:bg-primary aria-selected:text-primary-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      className={cn(
        'mt-5 rounded-md border bg-card p-5 focus-visible:outline-2 focus-visible:outline-ring [hidden]:hidden',
        className,
      )}
      {...props}
    />
  );
}
