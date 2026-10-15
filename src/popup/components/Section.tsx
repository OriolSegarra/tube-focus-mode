import type { ReactNode } from "react";

interface SectionProps {
  tag: string;
  title: string;
  children: ReactNode;
}

export function Section({ tag, title, children }: SectionProps) {
  return (
    <section className="border-t border-hairline pt-4 pb-5 px-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-accent">{tag}</span>
        <h2 className="font-display font-bold text-sm text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}
