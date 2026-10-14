import { ObjectId } from 'mongodb';
import { getDb } from '../db/connection.js';
import { generateSecureToken, hashToken } from '../utils/crypto.js';

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

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

  return {
    sessionId: result.insertedId.toString(),
    rawToken,
    expiresAt,
  };
}

export async function validateSession(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return null;

  const db = getDb();
  const sessionsCol = db.collection('admin_sessions');
  const sessionTokenHash = hashToken(rawToken);
  const now = new Date();

  const session = await sessionsCol.findOne({
    sessionTokenHash,
    revokedAt: null,
    expiresAt: { $gt: now },
  });

  if (!session) return null;

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

  const result = await sessionsCol.updateOne(
    { sessionTokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

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
}
