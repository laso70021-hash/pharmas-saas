import { useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

export function MobileNavigation({ children, title = 'Navigation' }: { children: ReactNode; title?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0 xl:hidden" aria-label="Open navigation" aria-expanded={open} title="Open navigation"><Menu /></Button>
      </SheetTrigger>
      <SheetContent side="left" aria-describedby={undefined} className="w-[min(320px,85vw)] sm:max-w-[320px] p-0 pt-12 flex flex-col overflow-hidden">
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <div className="flex-1 min-h-0 flex" onClick={(event) => {
          const target = event.target;
          if (target instanceof Element && target.closest('a,button')) setOpen(false);
        }}>{children}</div>
      </SheetContent>
    </Sheet>
  );
}