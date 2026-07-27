/**
 * Simple in-memory cache for Next.js
 * Reduces database connections by caching frequently accessed data
 * 
 * Features:
 * - TTL (Time To Live) support
 * - Auto-expiration of old entries
 * - Memory efficient
 * - No external dependencies
 */

const g = globalThis;

// Initialize cache store
if (!g.__appCache) {
  g.__appCache = new Map();
  g.__cacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
  };
}

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {any} - Cached value or undefined
 */
export function cacheGet(key) {
  const entry = g.__appCache.get(key);
  
  if (!entry) {
    g.__cacheStats.misses++;
    return undefined;
  }

  // Check if expired
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    g.__appCache.delete(key);
    g.__cacheStats.misses++;
    console.log(`🗑️ Cache expired: ${key}`);
    return undefined;
  }

  g.__cacheStats.hits++;
  console.log(`✅ Cache hit: ${key}`);
  return entry.value;
}

/**
 * Set value in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttlSeconds - Time to live in seconds (default: 300 = 5 minutes)
 */
export function cacheSet(key, value, ttlSeconds = 300) {
  const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
  
  g.__appCache.set(key, {
    value,
    expiresAt,
    createdAt: Date.now(),
  });

  g.__cacheStats.sets++;
  console.log(`💾 Cache set: ${key} (TTL: ${ttlSeconds}s)`);
}

/**
 * Delete value from cache
 * @param {string} key - Cache key
 */
export function cacheDelete(key) {
  g.__appCache.delete(key);
  console.log(`🗑️ Cache deleted: ${key}`);
}

/**
 * Clear all cache
 */
export function cacheClear() {
  g.__appCache.clear();
  console.log(`🗑️ Cache cleared completely`);
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    ...g.__cacheStats,
    size: g.__appCache.size,
    entries: Array.from(g.__appCache.entries()).map(([key, entry]) => ({
      key,
      expiresIn: entry.expiresAt ? Math.round((entry.expiresAt - Date.now()) / 1000) : 'never',
    })),
  };
}

/**
 * Get or set pattern - useful for caching with automatic fetch
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Async function to fetch data if not cached
 * @param {number} ttlSeconds - TTL for cache entry
 * @returns {Promise<any>} - Cached or fetched value
 */
export async function cacheGetOrSet(key, fetchFn, ttlSeconds = 300) {
  // Try to get from cache
  const cached = cacheGet(key);
  if (cached !== undefined) {
    return cached;
  }

  // Not in cache, fetch it
  console.log(`📥 Fetching data for: ${key}`);
  const value = await fetchFn();
  
  // Store in cache
  if (value !== null && value !== undefined) {
    cacheSet(key, value, ttlSeconds);
  }
  
  return value;
}

export default {
  get: cacheGet,
  set: cacheSet,
  delete: cacheDelete,
  clear: cacheClear,
  getStats: getCacheStats,
  getOrSet: cacheGetOrSet,
};
