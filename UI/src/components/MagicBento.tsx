import type { ReactNode } from 'react';

interface MagicBentoProps {
  children: ReactNode;
}

interface MagicBentoCardProps {
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  className?: string;
}

export function MagicBento({ children }: MagicBentoProps) {
  return <div className="magic-bento-grid">{children}</div>;
}

export function MagicBentoCard({
  children,
  title,
  subtitle,
  className = '',
}: MagicBentoCardProps) {
  return (
    <section className={`magic-bento-card ${className}`.trim()}>
      {(title || subtitle) && (
        <header className="mb-4">
          {title && <h2 className="text-lg font-semibold text-slate-100">{title}</h2>}
          {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
