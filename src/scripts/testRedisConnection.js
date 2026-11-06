import { connectRedis, closeRedis, isRedisHealthy, getRedisClient } from '../db/redis.js';

async function verify() {
  console.log('Testing Redis connectivity...');
  await connectRedis();

  if (isRedisHealthy()) {
    const client = getRedisClient();
    const ping = await client.ping();
    console.log(`✅ Redis is healthy! PING -> ${ping}`);
  } else {
    console.error('❌ Redis is not reachable.');
  }

  await closeRedis();
  process.exit(0);
}

verify();
