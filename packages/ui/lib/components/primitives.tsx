import { cn } from '../utils';
import { forwardRef, useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

/* ============================================================
   Reusable UI primitives — Earpiece design system (ep tokens).
   Used by side-panel and options pages alike.
   ============================================================ */

// ---------- Button ----------
type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'subtle';
type ButtonSize = 'sm' | 'md';

const BTN_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-ep font-medium active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ep-accent)]';

const BTN_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-[var(--ep-accent)] to-[var(--ep-accent-2)] text-white shadow-ep-glow hover:brightness-110',
  ghost: 'border border-ep-border bg-ep-surface-2 text-ep-muted hover:border-ep-border-strong hover:text-ep-text',
  danger: 'bg-[var(--ep-danger)]/90 text-white shadow-ep hover:bg-[var(--ep-danger)]',
  subtle: 'text-ep-muted hover:bg-ep-surface-2 hover:text-ep-text',
};

const BTN_SIZES: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-[12px]',
  md: 'px-4 py-2.5 text-sm',
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'ghost', size = 'md', loading, className, children, disabled, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(BTN_BASE, BTN_VARIANTS[variant], BTN_SIZES[size], className)}
      {...rest}>
      {loading && (
        <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" aria-hidden />
      )}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

// ---------- Input / Select ----------
const FIELD_BASE =
  'w-full rounded-ep border border-ep-border bg-ep-bg px-3 py-2 text-[13px] text-ep-text placeholder:text-ep-faint focus:border-[var(--ep-accent)] focus:outline-none';

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, invalid, ...rest }, ref) => (
  <input
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(FIELD_BASE, invalid && 'border-[var(--ep-danger)]', className)}
    {...rest}
  />
));
Input.displayName = 'Input';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...rest }, ref) => (
  <select ref={ref} className={cn(FIELD_BASE, 'cursor-pointer', className)} {...rest}>
    {children}
  </select>
));
Select.displayName = 'Select';

// ---------- Field (label + control + hint) ----------
const Field = ({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) => (
  <div className="min-w-0">
    <label
      htmlFor={htmlFor}
      className="text-ep-faint mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em]">
      {label}
    </label>
    {children}
    {hint && <p className="text-ep-faint mt-1 text-[11px] leading-relaxed">{hint}</p>}
  </div>
);

// ---------- Toggle ----------
const Toggle = ({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  id?: string;
}) => (
  <button
    type="button"
    id={id}
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="rounded-ep border-ep-border bg-ep-bg hover:border-ep-border-strong flex w-full items-center justify-between gap-3 border px-3 py-2.5 text-left">
    <span className="min-w-0 text-[13px]">{label}</span>
    <span
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors',
        checked
          ? 'bg-gradient-to-r from-[var(--ep-accent)] to-[var(--ep-accent-2)]'
          : 'border-ep-border bg-ep-surface-2 border',
      )}>
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
          checked ? 'left-[18px]' : '!bg-ep-faint left-0.5',
        )}
      />
    </span>
  </button>
);

// ---------- Card ----------
const Card = ({ title, children, className }: { title?: ReactNode; children: ReactNode; className?: string }) => (
  <section className={cn('border-ep-border bg-ep-surface shadow-ep rounded-xl border p-5', className)}>
    {title && <h2 className="mb-4 text-[13px] font-semibold">{title}</h2>}
    {children}
  </section>
);

// ---------- StatusDot ----------
const StatusDot = ({ state }: { state: 'on' | 'off' | 'error' }) => (
  <span
    aria-hidden
    className={cn(
      'h-1.5 w-1.5 shrink-0 rounded-full',
      state === 'on' && 'animate-pulse-dot bg-[var(--ep-success)]',
      state === 'off' && 'bg-[var(--ep-text-faint)]',
      state === 'error' && 'bg-[var(--ep-danger)]',
    )}
  />
);

// ---------- IconButton ----------
const IconButton = ({
  title,
  onClick,
  children,
  className,
}: {
  title: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={onClick}
    className={cn(
      'border-ep-border bg-ep-surface-2 text-ep-muted hover:border-ep-border-strong hover:text-ep-text flex h-7 w-7 items-center justify-center rounded-lg border',
      className,
    )}>
    {children}
  </button>
);

// ---------- CopyButton (copies + shows ✓ feedback) ----------
const CopyButton = ({
  text,
  title,
  className,
  children,
}: {
  text: string;
  title: string;
  className?: string;
  children?: ReactNode;
}) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className={cn('text-ep-muted hover:text-ep-text', className)}>
      {copied ? <span className="text-[var(--ep-success)]">✓</span> : children}
    </button>
  );
};

export { Button, Input, Select, Field, Toggle, Card, StatusDot, IconButton, CopyButton };
export type { ButtonProps, InputProps, SelectProps };
