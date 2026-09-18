import 'dotenv/config';

const required = (name, fallback) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Missing required env var: ${name}`);
  return value;
};

// Atlas connection strings often omit the database, which silently lands every
// collection in "test". Default it to the app database instead.
const withDatabase = (uri, dbName) => {
  const [base, query] = uri.split('?');
  const path = base.replace(/^(mongodb(?:\+srv)?:\/\/[^/]+)\/?(.*)$/, '$2');
  if (path) return uri;
  return `${base.replace(/\/$/, '')}/${dbName}${query ? `?${query}` : ''}`;
};

const mongoUri = process.env.MONGODB_URI ?? process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/voltcart';

export const env = {
  port: Number(required('PORT', 4000)),
  nodeEnv: required('NODE_ENV', 'development'),
  mongoUri: withDatabase(mongoUri, process.env.MONGODB_DB ?? 'voltcart'),
  redisUrl: required('REDIS_URL', 'redis://127.0.0.1:6379'),
  jwtSecret: required('JWT_SECRET', 'voltcart-dev-secret-change-me'),
  jwtExpiresIn: required('JWT_EXPIRES_IN', '7d'),
  clientOrigin: required('CLIENT_ORIGIN', 'http://localhost:5173'),
  reservationTtlSeconds: Number(required('RESERVATION_TTL_SECONDS', 180)),
  sweeperIntervalMs: Number(required('SWEEPER_INTERVAL_MS', 1000)),
  reconcileIntervalMs: Number(required('RECONCILE_INTERVAL_MS', 15000)),
};

export const isProd = env.nodeEnv === 'production';
