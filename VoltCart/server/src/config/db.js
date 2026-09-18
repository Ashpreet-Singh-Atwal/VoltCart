import mongoose from 'mongoose';
import { env } from './env.js';

let replicaSetAvailable = false;

export async function connectMongo() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });

  // Multi-document transactions only work on a replica set / mongos.
  // We detect it once so the order flow can pick the right code path.
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  replicaSetAvailable = Boolean(hello.setName || hello.msg === 'isdbgrid');

  console.log(
    `[mongo] connected -> ${mongoose.connection.name} (transactions: ${
      replicaSetAvailable ? 'enabled' : 'disabled - standalone server'
    })`
  );
  return mongoose.connection;
}

export const supportsTransactions = () => replicaSetAvailable;

/**
 * Runs `fn` inside a Mongo transaction when the deployment supports it,
 * otherwise runs it directly (single-node dev boxes).
 */
export async function withTransaction(fn) {
  if (!replicaSetAvailable) return fn(null);

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
