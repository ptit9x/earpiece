import type { Config } from 'tailwindcss';

/**
 * Earpiece AI shared Tailwind preset.
 * Semantic design tokens (ep-*): dark-first premium palette.
 * Light theme is driven by CSS variables in @extension/ui/global.css
 * toggled via the `light` class on the panel root (exampleThemeStorage).
 */
export default {
  darkMode: ['class', '.dark'],
  theme: {
    extend: {
      colors: {
        ep: {
          bg: 'var(--ep-bg)',
          surface: 'var(--ep-surface)',
          'surface-2': 'var(--ep-surface-2)',
          elevated: 'var(--ep-elevated)',
          border: 'var(--ep-border)',
          'border-strong': 'var(--ep-border-strong)',
          text: 'var(--ep-text)',
          muted: 'var(--ep-text-muted)',
          faint: 'var(--ep-text-faint)',
          accent: 'var(--ep-accent)',
          'accent-2': 'var(--ep-accent-2)',
          success: 'var(--ep-success)',
          danger: 'var(--ep-danger)',
          warning: 'var(--ep-warning)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        ep: '0 1px 2px rgba(0,0,0,0.25), 0 4px 16px rgba(0,0,0,0.2)',
        'ep-glow': '0 0 0 1px rgba(99,102,241,0.25), 0 4px 20px rgba(99,102,241,0.18)',
      },
      borderRadius: {
        ep: '10px',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'bounce-in': {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '60%': { opacity: '1', transform: 'scale(1.02)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.55', transform: 'scale(0.82)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'wave-bar': {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
        'thinking-dot': {
          '0%, 80%, 100%': { opacity: '0.25', transform: 'translateY(0)' },
          '40%': { opacity: '1', transform: 'translateY(-3px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out both',
        'slide-up': 'slide-up 220ms cubic-bezier(0.16,1,0.3,1) both',
        'bounce-in': 'bounce-in 260ms cubic-bezier(0.16,1,0.3,1) both',
        'pulse-dot': 'pulse-dot 1.6s ease-in-out infinite',
        shimmer: 'shimmer 1.4s linear infinite',
        'wave-bar': 'wave-bar 1.1s ease-in-out infinite',
        'thinking-dot': 'thinking-dot 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} as Omit<Config, 'content'>;
