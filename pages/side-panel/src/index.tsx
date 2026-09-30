import '@src/index.css';
import { createExtensionQueryClient } from '@extension/shared';
import SidePanel from '@src/SidePanel';
import { QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';

const queryClient = createExtensionQueryClient();

const init = () => {
  const appContainer = document.querySelector('#app-container');
  if (!appContainer) {
    throw new Error('Can not find #app-container');
  }
  const root = createRoot(appContainer);
  root.render(
    <QueryClientProvider client={queryClient}>
      <SidePanel />
    </QueryClientProvider>,
  );
};

init();
