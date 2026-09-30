/* eslint-disable */
// @ts-nocheck
// Chrome match patterns have no port component. Deriving one from
// URL.origin produces "http://localhost:20128/*", which chrome.permissions
// rejects outright - the exact shape a self-hosted router on a non-standard
// port hands you.

export function originPattern(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (!parsed.hostname) return null;
  // hostname, not host: host carries the port, hostname does not.
  return `${parsed.protocol}//${parsed.hostname}/*`;
}

// Plain http is only acceptable to a loopback address. Anything else means
// the API key crosses the network in clear text.
export function isLoopback(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function describeEndpoint(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, warning: 'Not a valid URL.' };
  }
  if (parsed.protocol === 'http:' && !isLoopback(parsed.hostname)) {
    return { ok: true, warning: `http:// to ${parsed.hostname} sends your API key unencrypted. Use https.` };
  }
  if (!/\/v1\/?$/.test(parsed.pathname)) {
    return { ok: true, warning: 'Base URL usually ends in /v1 (e.g. http://localhost:20128/v1).' };
  }
  return { ok: true, warning: '' };
}
