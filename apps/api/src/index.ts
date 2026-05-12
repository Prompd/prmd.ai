import express from 'express';
import cors from 'cors';
import { createScanner } from './scanner.js';
import { createLLMEnricher, createPassthroughEnricher } from './enricher.js';
import { createPrompdCompilerAdapter } from './compiler.js';
import { createClerkAuth, createDisabledAuth } from './auth.js';
import { connectMongo } from './db.js';
import { ipLimiter } from './rate-limit.js';
import { healthRouter } from './routes/health.js';
import { generateRouter } from './routes/generate.js';
import { downloadRouter } from './routes/download.js';
import { feedbackRouter } from './routes/feedback.js';

const PORT = Number(process.env.PORT ?? 3000);

const app = express();
// Cloud Run terminates TLS and forwards X-Forwarded-For. Trusting 1 hop
// makes req.ip the original client address — which is what the IP rate
// limiter keys on.
app.set('trust proxy', 1);
app.use(cors({ origin: true }));
app.use(express.json({ limit: '2mb' }));

const githubToken = process.env.GITHUB_TOKEN?.trim();
const scanner = createScanner(githubToken ? { githubToken } : {});

if (githubToken) {
  console.log('scanner: GITHUB_TOKEN configured — authenticated GitHub API access (5000 req/hr)');
} else {
  console.log('scanner: GITHUB_TOKEN not set — anonymous GitHub API access (60 req/hr, set for production)');
}

const passthroughEnricher = createPassthroughEnricher();

const googleApiKey = process.env.GOOGLE_API_KEY?.trim();
const llmEnricher = googleApiKey
  ? createLLMEnricher({
      apiKey: googleApiKey,
      model: process.env.LLM_MODEL?.trim() || undefined,
      log: (msg) => console.log(msg),
    })
  : null;

if (llmEnricher) {
  console.log('enricher: Gemini configured — URL flow will use LLM enrichment');
} else {
  console.log('enricher: GOOGLE_API_KEY not set — all flows use passthrough enrichment');
}

const compiler = createPrompdCompilerAdapter();

const clerkSecretKey = process.env.CLERK_SECRET_KEY?.trim();
const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY?.trim();
const auth = clerkSecretKey
  ? createClerkAuth({ secretKey: clerkSecretKey, publishableKey: clerkPublishableKey })
  : createDisabledAuth();

if (auth.enabled) {
  console.log('auth: Clerk configured — repo URL scanning requires signed-in users');
} else {
  console.log('auth: CLERK_SECRET_KEY not set — repo URL scanning will return 503');
}

// Mongo is optional. When unreachable, the api still serves requests; rate
// limiting falls back to IP-only and usage logging is skipped.
const mongoUri = process.env.MONGODB_URI?.trim();
void connectMongo(mongoUri).then((ok) => {
  if (ok) {
    console.log('mongo: connected — per-user rate limiting and usage logging are active');
  } else if (mongoUri) {
    console.log('mongo: connection failed — falling back to IP-only rate limiting, no usage logging');
  } else {
    console.log('mongo: MONGODB_URI not set — IP-only rate limiting, no usage logging');
  }
});

app.use('/api', healthRouter());
// Apply IP limiter to the cost-bearing routes only. Health stays open for
// Cloud Run probes.
app.use('/api/generate', ipLimiter);
app.use('/api/download', ipLimiter);
app.use('/api/feedback', ipLimiter);
app.use(
  '/api',
  generateRouter({ scanner, passthroughEnricher, llmEnricher, compiler, auth }),
);
app.use('/api', downloadRouter());
app.use('/api', feedbackRouter({ auth }));

app.listen(PORT, () => {
  console.log(`api listening on http://localhost:${PORT}`);
});
