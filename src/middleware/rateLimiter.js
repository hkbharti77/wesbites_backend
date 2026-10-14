import { getDb } from '../db/connection.js';

export class MemoryRateLimiter {
  constructor(windowMs = 15 * 60 * 1000, maxRequests = 10) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.hits = new Map();

    // Clean up expired buckets every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
  }

  isRateLimited(key) {
    const now = Date.now();
    const timestamps = this.hits.get(key) || [];
    const validTimestamps = timestamps.filter(ts => now - ts < this.windowMs);

    if (validTimestamps.length >= this.maxRequests) {
      this.hits.set(key, validTimestamps);
      return true;
    }

    validTimestamps.push(now);
    this.hits.set(key, validTimestamps);
    return false;
  }

  reset(key) {
    this.hits.delete(key);
  }

  cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.hits.entries()) {
      const valid = timestamps.filter(ts => now - ts < this.windowMs);
      if (valid.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, valid);
      }
    }
  }
}

/**
 * MongoDB-backed sliding window rate limiter for multi-instance / clustered deployments.
 * Operates without Redis, maintaining cluster-wide synchronization via atomic MongoDB operations
 * and TTL index on expiresAt.
 */
export class MongoRateLimiter {
  constructor(windowMs = 15 * 60 * 1000, maxRequests = 10) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  async isRateLimited(key) {
    try {
      const db = getDb();
      if (!db) return false;
      const col = db.collection('admin_rate_limits');

      const now = new Date();
      const windowStart = new Date(now.getTime() - this.windowMs);
      const expiresAt = new Date(now.getTime() + this.windowMs);

      // Clean expired hits and pull within window
      await col.updateOne(
        { key },
        { $pull: { hits: { $lt: windowStart } } }
      );

      // Fetch or initialize record
      const record = await col.findOne({ key });
      const currentHits = record?.hits || [];

      // Application logic check: verify hit count within active sliding window
      if (currentHits.length >= this.maxRequests) {
        return true;
      }

      // Record new hit
      await col.updateOne(
        { key },
        {
          $push: { hits: now },
          $set: { expiresAt, updatedAt: now },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true }
      );

      return false;
    } catch (err) {
      console.warn('MongoRateLimiter error, failing open to prevent denial-of-service:', err.message);
      return false;
    }
  }

  async reset(key) {
    try {
      const db = getDb();
      if (!db) return;
      await db.collection('admin_rate_limits').deleteOne({ key });
    } catch (err) {
      console.warn('MongoRateLimiter reset notice:', err.message);
    }
  }
}

/**
 * Hybrid Rate Limiter:
 * Uses MongoRateLimiter if RATE_LIMIT_STORAGE === 'mongodb', otherwise MemoryRateLimiter.
 */
export class HybridRateLimiter {
  constructor(windowMs, maxRequests) {
    this.memoryLimiter = new MemoryRateLimiter(windowMs, maxRequests);
    this.mongoLimiter = new MongoRateLimiter(windowMs, maxRequests);
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  isRateLimited(key) {
    if (process.env.RATE_LIMIT_STORAGE === 'mongodb') {
      return this.mongoLimiter.isRateLimited(key);
    }
    return this.memoryLimiter.isRateLimited(key);
  }

  reset(key) {
    if (process.env.RATE_LIMIT_STORAGE === 'mongodb') {
      return this.mongoLimiter.reset(key);
    }
    return this.memoryLimiter.reset(key);
  }
}

// 10 failed login attempts per 15 minutes per IP or email
export const authRateLimiter = new HybridRateLimiter(15 * 60 * 1000, 10);

// 5 password reset requests per 15 minutes
export const forgotPasswordRateLimiter = new HybridRateLimiter(15 * 60 * 1000, 5);

export function createRateLimiterMiddleware(limiterInstance, getRateKey = (req) => req.ip) {
  return async (req, res, next) => {
    if (process.env.DISABLE_RATE_LIMIT === 'true') {
      return next();
    }

    const key = getRateKey(req);
    const isLimited = await limiterInstance.isRateLimited(key);
    if (isLimited) {
      return res.status(429).json({
        error: 'Too many requests. Please try again after 15 minutes.',
        code: 'RATE_LIMIT_EXCEEDED',
      });
    }

    next();
  };
}
