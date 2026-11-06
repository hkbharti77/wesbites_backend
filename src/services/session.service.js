import { ObjectId } from 'mongodb';
import { getDb } from '../db/connection.js';
import { generateSecureToken, hashToken } from '../utils/crypto.js';
import { getRedisClient, isRedisHealthy } from '../db/redis.js';

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_TTL_SECONDS = 24 * 60 * 60;

/**
 * Cache session in Redis with TTL.
 */
async function cacheSessionInRedis(sessionTokenHash, sessionDoc, ttlSeconds = SESSION_TTL_SECONDS) {
  try {
    if (!isRedisHealthy()) return;
    const client = getRedisClient();
    if (!client) return;

    const payload = JSON.stringify({
      ...sessionDoc,
      _id: sessionDoc._id.toString(),
      userId: sessionDoc.userId.toString(),
    });

    const pipeline = client.pipeline();
    pipeline.set(`session:${sessionTokenHash}`, payload, 'EX', Math.max(ttlSeconds, 60));
    pipeline.sadd(`user_sessions:${sessionDoc.userId.toString()}`, sessionTokenHash);
    pipeline.expire(`user_sessions:${sessionDoc.userId.toString()}`, SESSION_TTL_SECONDS);
    await pipeline.exec();
  } catch (err) {
    console.warn('[Session Cache Warning] Failed to cache session in Redis:', err.message);
  }
}

/**
 * Evict session from Redis.
 */
async function evictSessionFromRedis(sessionTokenHash, userId = null) {
  try {
    if (!isRedisHealthy()) return;
    const client = getRedisClient();
    if (!client) return;

    const pipeline = client.pipeline();
    pipeline.del(`session:${sessionTokenHash}`);
    if (userId) {
      pipeline.srem(`user_sessions:${userId.toString()}`, sessionTokenHash);
    }
    await pipeline.exec();
  } catch (err) {
    console.warn('[Session Cache Warning] Failed to evict session from Redis:', err.message);
  }
}

export async function createSession({ userId, ipAddress, userAgent }) {
  const db = getDb();
  const sessionsCol = db.collection('admin_sessions');

  const rawToken = generateSecureToken(32);
  const sessionTokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

  const sessionDoc = {
    userId: typeof userId === 'string' ? new ObjectId(userId) : userId,
    sessionTokenHash,
    expiresAt,
    revokedAt: null,
    createdAt: now,
    lastSeenAt: now,
    ipAddress: ipAddress || 'unknown',
    userAgent: userAgent || 'unknown',
  };

  const result = await sessionsCol.insertOne(sessionDoc);
  sessionDoc._id = result.insertedId;

  // Cache in Redis for sub-millisecond future lookups
  await cacheSessionInRedis(sessionTokenHash, sessionDoc, SESSION_TTL_SECONDS);

  return {
    sessionId: result.insertedId.toString(),
    rawToken,
    expiresAt,
  };
}

export async function validateSession(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return null;

  const sessionTokenHash = hashToken(rawToken);
  const now = new Date();

  // 1. Fast path: Attempt lookup from Redis cache
  if (isRedisHealthy()) {
    try {
      const client = getRedisClient();
      if (client) {
        const cachedRaw = await client.get(`session:${sessionTokenHash}`);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          const expiresAt = new Date(cached.expiresAt);

          if (!cached.revokedAt && expiresAt > now) {
            // Restore native MongoDB BSON types
            return {
              ...cached,
              _id: new ObjectId(cached._id),
              userId: new ObjectId(cached.userId),
              expiresAt,
              createdAt: new Date(cached.createdAt),
              lastSeenAt: new Date(cached.lastSeenAt),
            };
          }
        }
      }
    } catch (err) {
      console.warn('[Session Cache Warning] Redis session fetch failed, falling back to MongoDB:', err.message);
    }
  }

  // 2. Fallback / Cache Miss: Query MongoDB
  const db = getDb();
  const sessionsCol = db.collection('admin_sessions');

  const session = await sessionsCol.findOne({
    sessionTokenHash,
    revokedAt: null,
    expiresAt: { $gt: now },
  });

  if (!session) return null;

  // Re-populate Redis cache on cache-miss
  const remainingSeconds = Math.max(Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000), 60);
  cacheSessionInRedis(sessionTokenHash, session, remainingSeconds).catch(() => {});

  // Touch lastSeenAt asynchronously
  sessionsCol.updateOne(
    { _id: session._id },
    { $set: { lastSeenAt: now } }
  ).catch(err => console.error('Failed to update lastSeenAt:', err));

  return session;
}

export async function revokeSessionByToken(rawToken) {
  if (!rawToken) return false;
  const db = getDb();
  const sessionsCol = db.collection('admin_sessions');
  const sessionTokenHash = hashToken(rawToken);

  const session = await sessionsCol.findOne({ sessionTokenHash });

  const result = await sessionsCol.updateOne(
    { sessionTokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  // Evict from Redis immediately
  await evictSessionFromRedis(sessionTokenHash, session?.userId);

  return result.modifiedCount > 0;
}

export async function revokeAllUserSessions(userId) {
  const db = getDb();
  const sessionsCol = db.collection('admin_sessions');
  const uId = typeof userId === 'string' ? new ObjectId(userId) : userId;

  await sessionsCol.updateMany(
    { userId: uId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  // Evict all user sessions from Redis
  try {
    if (isRedisHealthy()) {
      const client = getRedisClient();
      if (client) {
        const setKey = `user_sessions:${uId.toString()}`;
        const tokenHashes = await client.smembers(setKey);
        if (tokenHashes && tokenHashes.length > 0) {
          const keysToDelete = tokenHashes.map(h => `session:${h}`);
          keysToDelete.push(setKey);
          await client.del(...keysToDelete);
        }
      }
    }
  } catch (err) {
    console.warn('[Session Cache Warning] Failed to evict all user sessions from Redis:', err.message);
  }
}
