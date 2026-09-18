import Redis from 'ioredis';
import { env } from './env.js';

export const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

// A second connection is used for blocking stream reads so it never
// starves the command connection used by the HTTP request path.
export const redisBlocking = new Redis(env.redisUrl, {
  maxRetriesPerRequest: null,
});

redis.on('error', (err) => console.error('[redis] error:', err.message));
redisBlocking.on('error', (err) => console.error('[redis:blocking] error:', err.message));

export async function connectRedis() {
  await redis.ping();
  // Credentials must never reach the logs.
  console.log('[redis] connected ->', env.redisUrl.replace(/(:\/\/)[^@]*@/, '$1***@'));
}
