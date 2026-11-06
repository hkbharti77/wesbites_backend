import { getRedisClient, isRedisHealthy } from '../db/redis.js';

const DEFAULT_TTL_SECONDS = 300; // 5 minutes

/**
 * Fetch from cache, or invoke fallback fetcher and cache result.
 * Gracefully executes fetcher if Redis is offline or cache is disabled.
 */
export async function getOrSetCache(key, ttlSeconds = DEFAULT_TTL_SECONDS, fetcherFn) {
  const isCacheEnabled = process.env.ENABLE_REDIS_CACHE !== 'false';

  if (isCacheEnabled && isRedisHealthy()) {
    try {
      const client = getRedisClient();
      if (client) {
        const cached = await client.get(`cache:${key}`);
        if (cached) {
          return JSON.parse(cached);
        }
      }
    } catch (err) {
      console.warn(`[Cache Warning] Failed to read key "${key}":`, err.message);
    }
  }

  // Cache miss or Redis offline -> execute fetcher
  const freshData = await fetcherFn();

  if (isCacheEnabled && isRedisHealthy() && freshData !== undefined && freshData !== null) {
    try {
      const client = getRedisClient();
      if (client) {
        await client.set(`cache:${key}`, JSON.stringify(freshData), 'EX', ttlSeconds);
      }
    } catch (err) {
      console.warn(`[Cache Warning] Failed to set key "${key}":`, err.message);
    }
  }

  return freshData;
}

/**
 * Invalidate all keys matching a prefix or pattern.
 * e.g. invalidateCacheByPrefix('cms:public')
 */
export async function invalidateCacheByPrefix(prefix) {
  if (!isRedisHealthy()) return;

  try {
    const client = getRedisClient();
    if (!client) return;

    const pattern = `cache:${prefix}*`;
    let cursor = '0';

    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        await client.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err) {
    console.warn(`[Cache Warning] Failed to invalidate prefix "${prefix}":`, err.message);
  }
}

/**
 * Clear a specific cache key.
 */
export async function deleteCacheKey(key) {
  if (!isRedisHealthy()) return;
  try {
    const client = getRedisClient();
    if (client) {
      await client.del(`cache:${key}`);
    }
  } catch (err) {
    console.warn(`[Cache Warning] Failed to delete key "${key}":`, err.message);
  }
}

