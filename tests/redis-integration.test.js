import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import assert from 'assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { connectDB, closeDB } from '../src/db/connection.js';
import { connectRedis, closeRedis, isRedisHealthy, getRedisClient } from '../src/db/redis.js';
import { authRateLimiter } from '../src/middleware/rateLimiter.js';
import { createSession, validateSession, revokeSessionByToken } from '../src/services/session.service.js';
import { getOrSetCache, invalidateCacheByPrefix, deleteCacheKey } from '../src/services/cache.service.js';

let passed = 0;
let failed = 0;

function report(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ✅ PASS: ${name} ${detail}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${name} ${detail}`);
  }
}

async function runTests() {
  console.log('\n========================================');
  console.log('🧪 Starting Redis Integration Test Suite');
  console.log('========================================\n');

  try {
    // Step 0: Connect to DB and Redis
    console.log('1. Connecting to MongoDB & Redis...');
    await connectDB();
    await connectRedis();

    const redisReady = isRedisHealthy();
    report('Redis Connection & Health Check', redisReady, redisReady ? '(Ready)' : '(Offline)');

    if (!redisReady) {
      console.error('Cannot proceed with live Redis tests when Redis is not connected.');
      process.exit(1);
    }

    const client = getRedisClient();

    // Step 1: Redis Basic Ping & Key Operation
    console.log('\n2. Verifying Basic Cloud Redis Operations...');
    const ping = await client.ping();
    report('Cloud Redis PING', ping === 'PONG', `Response: ${ping}`);

    // Step 2: Rate Limiting with Redis
    console.log('\n3. Testing Redis Sliding Window Rate Limiting...');
    const testRateKey = `test-user-${Date.now()}`;
    await authRateLimiter.reset(testRateKey);

    let wasLimited = false;
    // authRateLimiter max is 10
    for (let i = 0; i < 12; i++) {
      const limited = await authRateLimiter.isRateLimited(testRateKey);
      if (limited) {
        wasLimited = true;
        break;
      }
    }
    report('Rate Limiter Triggers at Threshold', wasLimited, '(Blocked excess requests)');

    // Reset rate limit
    await authRateLimiter.reset(testRateKey);
    const afterReset = await authRateLimiter.isRateLimited(testRateKey);
    report('Rate Limiter Reset', afterReset === false, '(Permitted request after reset)');
    await authRateLimiter.reset(testRateKey);

    // Step 3: Session Acceleration & Cache Invalidation
    console.log('\n4. Testing Session Caching & Immediate Revocation...');
    const dummyUserId = '64f0a0000000000000000001';
    const newSession = await createSession({
      userId: dummyUserId,
      ipAddress: '127.0.0.1',
      userAgent: 'Redis-Integration-Test-Agent',
    });

    report('Create Session & Cache in Redis', Boolean(newSession && newSession.rawToken));

    // Validate session (should hit Redis fast path)
    const validated = await validateSession(newSession.rawToken);
    report('Validate Session from Cache', Boolean(validated && validated.userId.toString() === dummyUserId));

    // Revoke session
    const revoked = await revokeSessionByToken(newSession.rawToken);
    report('Revoke Session', revoked === true);

    // Validate again (should be null)
    const validatedAfterRevoke = await validateSession(newSession.rawToken);
    report('Session Denied After Revocation', validatedAfterRevoke === null);

    // Step 4: Cache Service (Public Endpoints)
    console.log('\n5. Testing Cache Service (getOrSetCache & Invalidation)...');
    let dbCallCount = 0;
    const testFetcher = async () => {
      dbCallCount++;
      return { message: 'hello from db simulation', timestamp: Date.now() };
    };

    const cacheKey = `test:item:${Date.now()}`;
    const result1 = await getOrSetCache(cacheKey, 60, testFetcher);
    const result2 = await getOrSetCache(cacheKey, 60, testFetcher);

    report('Cache Hit Avoids DB Execution', dbCallCount === 1, `(DB call count: ${dbCallCount})`);
    report('Cached Data Consistency', result1.message === result2.message);

    // Invalidation
    await invalidateCacheByPrefix('test:item:');
    const result3 = await getOrSetCache(cacheKey, 60, testFetcher);
    report('Cache Invalidation Flushes Stale Data', dbCallCount === 2, `(DB re-invoked, count: ${dbCallCount})`);

    await deleteCacheKey(cacheKey);

    // Final Cleanup & Shutdown
    console.log('\n6. Cleaning Up Connections...');
    await closeRedis();
    await closeDB();
    report('Clean Shutdown of Redis & MongoDB', true);

    console.log('\n========================================');
    console.log(`Results: ${passed} PASSED | ${failed} FAILED`);
    console.log('========================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unhandled test execution error:', err);
    await closeRedis().catch(() => {});
    await closeDB().catch(() => {});
    process.exit(1);
  }
}

runTests();

