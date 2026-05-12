import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * One document per Clerk user that has scanned a repo URL through prmd.ai.
 * Tracks first/last seen for retention analytics and a running totalScans
 * counter so we can spot heavy users without aggregating the Usage
 * collection. Manual-flow generations don't touch this collection (no user
 * identity).
 *
 * The `users` collection is provisioned in MongoDB Atlas under the
 * `prmd-ai` database.
 */
const UserSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    totalScans: { type: Number, default: 0 },
  },
  {
    collection: 'users',
    timestamps: { createdAt: false, updatedAt: 'updatedAt' },
  },
);

export type UserDoc = InferSchemaType<typeof UserSchema>;
export const User = model<UserDoc>('User', UserSchema);
