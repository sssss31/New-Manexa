import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Premium glass section panel with a titled header + optional right slot.
export function Panel({
  title,
  icon,
  right,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  icon?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("glass-panel relative z-[1]", className)}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-white/8">
          <div className="flex items-center gap-2">
            {icon && <span className="text-accent">{icon}</span>}
            {title && <h2 className="text-sm font-medium text-fg tracking-tight">{title}</h2>}
          </div>
          {right && <div className="text-xs text-muted">{right}</div>}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
