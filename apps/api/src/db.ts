import dns from 'node:dns';
import mongoose from 'mongoose';

/**
 * Mongo connection lifecycle for the prmd.ai API.
 *
 * Degrades gracefully: when MONGODB_URI is absent or the cluster is
 * unreachable, the api boots without persistence. Rate limiting falls back
 * to IP-only (in-memory) and usage logging is skipped. Lets local dev run
 * against just the Gemini + GitHub flow without standing up a database.
 */

let connectedFlag = false;

export async function connectMongo(uri: string | undefined): Promise<boolean> {
  if (!uri) return false;
  if (connectedFlag) return true;

  // Workaround for Node's c-ares resolver sometimes refusing SRV lookups
  // on Windows even when system DNS is configured correctly. Setting
  // MONGODB_DNS_SERVERS in .env (e.g. "8.8.8.8,1.1.1.1") forces c-ares to
  // use the listed servers. Unset on Cloud Run → native resolver, which
  // handles SRV correctly via GCP's internal DNS.
  const dnsServers = process.env.MONGODB_DNS_SERVERS?.split(',').map((s) => s.trim()).filter(Boolean);
  if (dnsServers && dnsServers.length > 0) {
    dns.setServers(dnsServers);
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      // Force connection to fail fast if the URI is wrong — we don't want
      // boot to hang for 30s waiting on a misconfigured cluster.
      connectTimeoutMS: 5000,
    });
    connectedFlag = true;
    return true;
  } catch (err) {
    // Surface the failure reason so misconfig is debuggable. The URI itself
    // is not logged because it contains credentials; only the error message.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`mongo: connect error — ${message}`);
    return false;
  }
}

export function isMongoConnected(): boolean {
  return connectedFlag && mongoose.connection.readyState === 1;
}
