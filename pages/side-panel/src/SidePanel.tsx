import '@src/SidePanel.css';
import { t } from '@extension/i18n';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';

const SidePanel = () => {
  const { isLight } = useStorage(exampleThemeStorage);

  return (
    <div className={cn('flex h-screen w-full flex-col', isLight ? 'bg-white' : 'bg-gray-900')}>
      <header
        className={cn(
          'flex items-center gap-2 border-b px-4 py-3',
          isLight ? 'border-gray-200 text-gray-900' : 'border-gray-700 text-gray-100',
        )}>
        <span className="text-xl" role="img" aria-label="Earpiece AI logo">
          🎧
        </span>
        <h1 className="text-base font-semibold">Earpiece AI</h1>
        <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
          {t('panelStatusIdle')}
        </span>
      </header>

      <main className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <section
          className={cn(
            'rounded-lg border p-4 text-center text-sm',
            isLight ? 'border-gray-200 text-gray-500' : 'border-gray-700 text-gray-400',
          )}>
          {t('panelStatusIdle')}
        </section>

        <button
          type="button"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
          {t('panelStart')}
        </button>
      </main>

      <footer
        className={cn(
          'border-t px-4 py-2 text-xs',
          isLight ? 'border-gray-200 text-gray-400' : 'border-gray-700 text-gray-500',
        )}>
        v{chrome.runtime.getManifest().version}
      </footer>
    </div>
  );
};

export default withErrorBoundary(withSuspense(SidePanel, <LoadingSpinner />), ErrorDisplay);
