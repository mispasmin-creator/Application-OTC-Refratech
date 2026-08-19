// Clean, direct fetch for Google Apps Script
// - Direct real-time parallel GET requests with no stale cache delays
// - POST / Write requests queued sequentially to prevent Google Sheets concurrency conflicts

let writeQueue = Promise.resolve();

/**
 * Clean live fetch for Google Apps Script.
 * - GET requests: Direct real-time fetch with parallel execution
 * - POST requests: Sequentially serialized for Google Sheets write integrity
 */
export const serialFetch = (url, options) => {
  const method = options && options.method ? options.method.toUpperCase() : 'GET';
  const isGet = method === 'GET';

  if (isGet) {
    // Direct real-time fetch without stale caching
    return fetch(url, options);
  }

  // For POST (writes): Execute sequentially to guarantee Google Sheets write integrity
  const executeWrite = writeQueue.then(async () => {
    return fetch(url, options);
  });

  writeQueue = executeWrite.catch(() => {});
  return executeWrite;
};

export const clearSerialFetchCache = () => {};
