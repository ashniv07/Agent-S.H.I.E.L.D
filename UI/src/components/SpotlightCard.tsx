import { useState, type ReactNode } from 'react';

interface SpotlightCardProps {
  title: string;
  description: string;
  icon?: ReactNode;
  children?: ReactNode;
}

export function SpotlightCard({ title, description, icon, children }: SpotlightCardProps) {
  const [spotlight, setSpotlight] = useState({ x: 50, y: 50 });

  return (
    <article
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        setSpotlight({ x, y });
      }}
      className="spotlight-card relative h-[220px] w-full rounded-2xl border border-slate-700/80 bg-slate-900/75 p-4 sm:h-[240px] sm:p-5 md:h-[250px]"
      style={{
        backgroundImage: `radial-gradient(circle at ${spotlight.x}% ${spotlight.y}%, rgba(56, 189, 248, 0.22), transparent 45%)`,
      }}
    >
      <div className="relative z-10 flex h-full flex-col gap-3">
        <div className="mb-3 flex items-center gap-3">
          {icon && (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/10 text-cyan-300">
              {icon}
            </span>
          )}
          <h3 className="text-sm font-semibold text-slate-100 sm:text-base">{title}</h3>
        </div>
        <p className="text-xs text-slate-300 sm:text-sm">{description}</p>
        <div className="mt-auto">{children}</div>
      </div>
    </article>
  );
}
