/**
 * One-shot admin script: clear all anonymous URL-flow usage records.
 * Used during dev testing to reset the per-IP rate limit without waiting
 * an hour. Run from apps/api/ via:
 *   npx tsx --env-file-if-exists=.env scripts/clear-anon-usage.ts
 *
 * Not part of the deployed image — `scripts/` is excluded from the build.
 */
import { connectMongo } from '../src/db.js';
import { Usage } from '../src/models/usage.js';
import mongoose from 'mongoose';

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  const ok = await connectMongo(uri);
  if (!ok) {
    console.error('Could not connect to Mongo');
    process.exit(1);
  }
  const result = await Usage.deleteMany({
    userId: { $exists: false },
    sourceKind: { $ne: 'manual' },
  });
  console.log(`Deleted ${result.deletedCount} anonymous URL-flow usage records`);
  await mongoose.disconnect();
  process.exit(0);
}

void main();
