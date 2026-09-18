import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { redis } from '../config/redis.js';

const here = dirname(fileURLToPath(import.meta.url));
const lua = (name) => readFileSync(join(here, 'lua', name), 'utf8');

/**
 * Scripts are registered as custom ioredis commands. ioredis takes care of
 * EVALSHA + automatic fallback to EVAL when the script is not cached yet.
 * Keys are passed through ARGV (numberOfKeys: 0) because the key names are
 * derived from the sale id inside the script; this targets a single Redis
 * node/primary, which is the deployment we run.
 */
redis.defineCommand('fsReserve', { numberOfKeys: 0, lua: lua('reserve.lua') });
redis.defineCommand('fsRelease', { numberOfKeys: 0, lua: lua('release.lua') });
redis.defineCommand('fsCommit', { numberOfKeys: 0, lua: lua('commit.lua') });
redis.defineCommand('fsRestock', { numberOfKeys: 0, lua: lua('restock.lua') });

export { redis as scriptedRedis };
