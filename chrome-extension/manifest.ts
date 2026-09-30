import { readFileSync } from 'node:fs';
import type { ManifestType } from '@extension/shared';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

/**
 * Earpiece AI — MV3 manifest.
 *
 * Permissions rationale:
 * - storage: settings + transcript history persistence
 * - tabCapture: capture meeting tab audio (interviewer side only)
 * - offscreen: run Web Speech API in a DOM context (service worker has no DOM)
 * - sidePanel: main UI — opens on action click (see background/index.ts)
 *
 * Content scripts are injected ONLY into known meeting platforms.
 */
const manifest = {
  manifest_version: 3,
  default_locale: 'en',
  name: '__MSG_extensionName__',
  browser_specific_settings: {
    gecko: {
      id: 'earpiece@ptit9x.dev',
      strict_min_version: '109.0',
    },
  },
  version: packageJson.version,
  description: '__MSG_extensionDescription__',
  host_permissions: [],
  permissions: ['storage', 'tabCapture', 'offscreen', 'sidePanel', 'activeTab', 'scripting'],
  options_page: 'options/index.html',
  background: {
    service_worker: 'background.js',
    type: 'module',
  },
  action: {
    default_icon: 'icon-34.png',
  },
  icons: {
    '128': 'icon-128.png',
  },
  content_scripts: [
    {
      matches: ['https://meet.google.com/*', '*://*.zoom.us/*', '*://*.teams.microsoft.com/*'],
      js: ['content-ui/all.iife.js'],
      css: ['content.css'],
    },
  ],
  web_accessible_resources: [
    {
      resources: ['*.js', '*.css', '*.svg', 'icon-128.png', 'icon-34.png'],
      matches: ['*://meet.google.com/*', '*://*.zoom.us/*', '*://*.teams.microsoft.com/*'],
    },
  ],
  side_panel: {
    default_path: 'side-panel/index.html',
  },
} satisfies ManifestType;

export default manifest;
