import type { ReactNode } from 'react';

export type HeaderProps = {
  logoSize?: 'sm' | 'md';
  title: ReactNode;
  subtitle?: ReactNode;
  actionContent?: ReactNode;
  className?: string;
};

export const Header = ({ logoSize = 'sm', title, subtitle, actionContent, className = '' }: HeaderProps) => {
  const isSm = logoSize === 'sm';
  return (
    <header className={`flex items-center justify-between gap-3 ${className}`}>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className={`truncate font-semibold tracking-tight ${isSm ? 'text-[15px]' : 'text-lg'}`}>{title}</h1>
          {subtitle && (
            <div className={`text-ep-muted flex items-center gap-1.5 truncate ${isSm ? 'text-[11px]' : 'text-[12px]'}`}>
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {actionContent && <div className="flex shrink-0 items-center gap-2">{actionContent}</div>}
    </header>
  );
};
