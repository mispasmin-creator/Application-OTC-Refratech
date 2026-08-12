// Global serial fetch queue with caching for Google Apps Script
// - GET requests are cached for 60 seconds
// - Simultaneous GET requests to the same URL share one in-flight request
// - POST/write requests clear the cache so fresh data is fetched next time

let fetchQueue = Promise.resolve();
const responseCache = new Map(); // url -> { text, timestamp }
const inFlight = new Map();      // url -> Promise<string> (deduplication)
const CACHE_TTL = 60 * 1000;    // 60 seconds

/** Wraps a text string into a response-like object */
const makeFakeResponse = (text) => ({
  ok: true,
  status: 200,
  text: () => Promise.resolve(text),
  json: () => Promise.resolve(JSON.parse(text)),
});

/**
 * Serialized fetch for Google Apps Script with caching and deduplication.
 * - GET requests: served from cache if fresh, otherwise queued once and shared
 * - POST requests: always sent, then cache is cleared so next GET gets fresh data
 */
export const serialFetch = (url, options) => {
  const method = options && options.method ? options.method.toUpperCase() : 'GET';
  const isGet = method === 'GET';

  if (isGet) {
    // 1. Return from cache if still fresh
    const cached = responseCache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return Promise.resolve(makeFakeResponse(cached.text));
    }

    // 2. Reuse existing in-flight request for same URL
    if (inFlight.has(url)) {
      return inFlight.get(url).then((text) => makeFakeResponse(text));
    }
  }

  // 3. Queue the actual network fetch
  const fetchPromise = fetchQueue.then(() => fetch(url, options));
  fetchQueue = fetchPromise.catch(() => {}); // prevent chain breaking on error

  if (isGet) {
    // Read response body once and share with all listeners
    const textPromise = fetchPromise.then((res) => res.text());
    inFlight.set(url, textPromise);

    textPromise
      .then((text) => {
        // Cache only valid JSON responses (not HTML error pages)
        try {
          JSON.parse(text);
          responseCache.set(url, { text, timestamp: Date.now() });
        } catch (_) { /* don't cache HTML / invalid responses */ }
        inFlight.delete(url);
      })
      .catch(() => inFlight.delete(url));

    return textPromise.then((text) => makeFakeResponse(text));
  }

  // For POST/write: clear cache after success so next fetch gets fresh data
  return fetchPromise.then((res) => {
    responseCache.clear();
    return res;
  });
};

/** Call this to manually invalidate the cache (e.g., after a delete) */
export const clearSerialFetchCache = () => responseCache.clear();
