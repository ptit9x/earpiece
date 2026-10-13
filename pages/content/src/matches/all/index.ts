/**
 * Content script: Google Meet caption observer.
 *
 * Watches the caption overlay DOM with a MutationObserver and forwards each
 * speaker+text pair to the background service worker as `caption` messages.
 * Also listens for `start-captions` / `stop-captions` from the background so
 * the observer only runs while a session is active.
 *
 * This lives in the main-world content script (IIFE, no React) because it
 * reads page DOM directly and must survive navigations inside the SPA.
 */

console.log('[Earpiece] Caption observer content script loaded');

// ---------------------------------------------------------------- state

let observer: MutationObserver | null = null;
let scanTimer: ReturnType<typeof setInterval> | null = null;
let active = false;

// Track last text per speaker so we can compute deltas in the background.
// The background already handles delta computation, so we just forward the
// full current text for each speaker on every mutation.
const lastSent = new Map<string, string>();

// ---------------------------------------------------------------- selectors

// Google Meet caption region aria-labels vary by locale. We maintain a list
// of known translations and fall back to structural detection so captions
// work regardless of the user's UI language.
const CAPTION_LABELS = [
  // English variants
  'Captions',
  'Closed captions',
  // Vietnamese
  'Phụ đề',
  // CJK
  '字幕', // Chinese (Simplified & Traditional) / Japanese
  '자막', // Korean
  // European
  'Sous-titres', // French
  'Untertitel', // German
  'Subtítulos', // Spanish
  'Legendas', // Portuguese
  'Sottotitoli', // Italian
  'Ondertitels', // Dutch
  // Other
  'Субтитры', // Russian
  'คำบรรยาย', // Thai
  'Altyazılar', // Turkish
  'Napisy', // Polish
];

// Build a compound selector for all known labels.
const CAPTION_REGION_SELECTOR = CAPTION_LABELS.map(label => `[role="region"][aria-label="${label}"]`).join(', ');

// Structural fallback: look for any role="region" whose children look like
// caption items (multiple divs each containing sub-divs with short text).
// This covers unknown locales and future Google Meet DOM changes.
const looksLikeCaptions = (el: Element): boolean => {
  const children = el.children;
  if (children.length === 0 || children.length > 12) return false;
  let captionLikeCount = 0;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!(child instanceof HTMLElement)) continue;
    // Each caption item has at least 2 child divs (speaker name + text),
    // and optionally an img (avatar). Skip items that don't match.
    const divCount = Array.from(child.children).filter(c => c instanceof HTMLElement && c.tagName === 'DIV').length;
    if (divCount >= 2) captionLikeCount++;
  }
  // If at least 1 child matches the pattern, it's likely a caption region.
  return captionLikeCount >= 1;
};

const findCaptionRegion = (): Element | null => {
  // Fast path: try known aria-labels.
  const byLabel = document.querySelector(CAPTION_REGION_SELECTOR);
  if (byLabel) return byLabel;

  // Structural fallback: scan all regions.
  const regions = document.querySelectorAll('[role="region"]');
  for (const region of regions) {
    if (looksLikeCaptions(region)) {
      const label = region.getAttribute('aria-label') || '(none)';
      console.log('[Earpiece] Caption region found via structural fallback, aria-label:', label);
      return region;
    }
  }

  return null;
};

// ---------------------------------------------------------------- observer

const extractCaptions = (region: Element): Array<{ name: string; text: string }> => {
  const results: Array<{ name: string; text: string }> = [];

  // Each caption line in Google Meet is a top-level child of the region.
  // Structure (as of 2025–2026):
  //   <div>           ← caption item
  //     <img .../>    ← avatar (optional)
  //     <div>         ← speaker name container
  //       <span>Speaker Name</span>
  //     </div>
  //     <div>         ← text container
  //       <span>caption text here</span>
  //     </div>
  //   </div>
  //
  // Because class names are minified, we walk by structure, not class.

  const items = region.children;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!(item instanceof HTMLElement)) continue;

    // Collect all divs that are NOT image containers.
    const divs: HTMLElement[] = [];
    for (let j = 0; j < item.children.length; j++) {
      const child = item.children[j];
      if (child instanceof HTMLElement && child.tagName === 'DIV') {
        divs.push(child);
      }
    }

    if (divs.length < 2) {
      // Possibly a single-div structure. Try extracting text from the whole item.
      const text = item.textContent?.trim();
      if (text) results.push({ name: '', text });
      continue;
    }

    // First div → speaker name, last div → caption text.
    const name = divs[0].textContent?.trim() || '';
    const text = divs[divs.length - 1].textContent?.trim() || '';
    if (text) results.push({ name, text });
  }

  return results;
};

const onMutation = () => {
  const region = findCaptionRegion();
  if (!region) return;

  const captions = extractCaptions(region);
  for (const { name, text } of captions) {
    if (!text) continue;
    // Only forward if the text actually changed for this speaker.
    const key = name || '__anon__';
    if (lastSent.get(key) === text) continue;
    lastSent.set(key, text);

    try {
      chrome.runtime.sendMessage({
        type: 'caption',
        name,
        text,
        ts: Date.now(),
      });
    } catch {
      // Extension context invalidated — stop observing.
      stopObserving();
    }
  }
};

const startObserving = () => {
  if (observer) return;

  lastSent.clear();

  // Report whether captions are currently visible.
  const region = findCaptionRegion();
  console.log('[Earpiece] startObserving — caption region:', region ? 'FOUND' : 'NOT FOUND');
  if (region) {
    console.log(
      '[Earpiece] caption region aria-label:',
      region.getAttribute('aria-label'),
      'children:',
      region.children.length,
    );
  } else {
    // Log all regions for debugging.
    const allRegions = document.querySelectorAll('[role="region"]');
    console.log('[Earpiece] No caption region found. All [role=region] elements:', allRegions.length);
    allRegions.forEach((r, i) =>
      console.log(`  [${i}] aria-label="${r.getAttribute('aria-label')}" children=${r.children.length}`),
    );
  }
  try {
    chrome.runtime.sendMessage({
      type: 'caption-status',
      available: Boolean(region),
    });
  } catch {
    // ignore
  }

  // MutationObserver on the caption region if it exists now.
  if (region) {
    observer = new MutationObserver(onMutation);
    observer.observe(region, { childList: true, subtree: true, characterData: true });
    // Process whatever is already there.
    onMutation();
  }

  // Google Meet is an SPA — the caption region may appear later (when the
  // user turns captions on). Scan for it periodically.
  if (!scanTimer) {
    scanTimer = setInterval(() => {
      if (!active) return;
      const r = findCaptionRegion();

      if (r && !observer) {
        // Caption region just appeared.
        observer = new MutationObserver(onMutation);
        observer.observe(r, { childList: true, subtree: true, characterData: true });
        try {
          chrome.runtime.sendMessage({ type: 'caption-status', available: true });
        } catch {
          // ignore
        }
        onMutation();
      } else if (!r && observer) {
        // Caption region disappeared (user turned off captions).
        observer.disconnect();
        observer = null;
        lastSent.clear();
        try {
          chrome.runtime.sendMessage({ type: 'caption-status', available: false });
        } catch {
          // ignore
        }
      }
    }, 2000);
  }
};

const stopObserving = () => {
  active = false;
  observer?.disconnect();
  observer = null;
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
  }
  lastSent.clear();
};

// ---------------------------------------------------------------- messages

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'start-captions') {
    active = true;
    startObserving();
    sendResponse({ ok: true });
  } else if (msg?.type === 'stop-captions') {
    stopObserving();
    sendResponse({ ok: true });
  }
});
