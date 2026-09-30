import 'webextension-polyfill';

// Open the side panel when the toolbar action is clicked (no popup).
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(err => console.error('Earpiece: setPanelBehavior failed', err));

console.log('Earpiece AI background loaded');
