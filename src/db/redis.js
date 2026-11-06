import Redis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

let redisClient = null;
let isConnected = false;

/**
 * Configure and return an ioredis client instance.
 */
function createClient() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn('[Redis] No REDIS_URL found in environment. Running in Redis-disabled mode.');
    return null;
  }

  const requiresTls = redisUrl.startsWith('rediss://') || redisUrl.includes('sslmode=require');
  const normalizedUrl = redisUrl.replace(/\?sslmode=require.*$/, '');

  const options = {
    maxRetriesPerRequest: 3,
    connectTimeout: 10000,
    enableReadyCheck: true,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 10) {
        console.warn('[Redis] Max reconnection attempts reached. Marking Redis as offline.');
        return null;
      }
      return Math.min(times * 300, 3000);
    },
  };

  if (requiresTls) {
    try {
      const parsed = new URL(normalizedUrl.startsWith('redis') ? normalizedUrl : `redis://${normalizedUrl}`);
      options.tls = {
        rejectUnauthorized: false,
        servername: parsed.hostname,
      };
    } catch {
      options.tls = { rejectUnauthorized: false };
    }
  }

  const client = new Redis(normalizedUrl, options);

  client.on('connect', () => {
    console.log('⚡ [Redis] Connecting to cloud cluster...');
  });

  client.on('ready', () => {
    isConnected = true;
    console.log('✅ [Redis] Connection ready and operational');
  });

  client.on('error', (err) => {
    isConnected = false;
    console.warn('[Redis Warning]:', err.message);
  });

  client.on('close', () => {
    isConnected = false;
  });

  client.on('end', () => {
    isConnected = false;
  });

  return client;
}

/**
 * Initialize Redis connection asynchronously.
 * Does not throw error if Redis fails to boot, ensuring resilient server startup.
 */
export async function connectRedis() {
  if (!redisClient) {
    redisClient = createClient();
  }

  if (!redisClient) {
    return null;
  }

  try {
    await redisClient.connect();
    isConnected = true;
    return redisClient;
  } catch (err) {
    isConnected = false;
    console.warn('[Redis Boot Warning] Could not establish initial connection. Fallback enabled:', err.message);
    return null;
  }
}

/**
 * Get the active Redis client singleton.
 */
export function getRedisClient() {
  return redisClient;
}

/**
 * Check whether Redis is currently healthy and responding.
 */
export function isRedisHealthy() {
  return Boolean(redisClient && isConnected && redisClient.status === 'ready');
}

/**
 * Gracefully close Redis connection.
 */
export async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      redisClient.disconnect();
    } finally {
      isConnected = false;
      redisClient = null;
    }
  }
}

