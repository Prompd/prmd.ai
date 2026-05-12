# prmd.ai deployment

prmd.ai ships into the **`prompd-io` GCP project**, alongside the
prompd.app editor backend and the prompd.io marketing site. It uses the
shared `us-central1-docker.pkg.dev/prompd-io/docker-repo` Artifact Registry
that those services already write to.

Two Cloud Run services:

| Service        | Container                                     | Port | Cloud Run name |
|----------------|-----------------------------------------------|------|----------------|
| API            | Express + tsx (`apps/api`)                    | 8080 | `api-prmd-ai`  |
| Web            | nginx serving the Vite SPA + `/api/*` proxy   | 8080 | `prmd-ai`      |

The web service proxies `/api/*` to the API service URL (baked at build
time via the `_API_URL` substitution), so the SPA's `fetch('/api/...')`
calls work the same in prod as in dev.

## One-time setup

Run once on a fresh checkout. `prompd-io` already exists, billing is on,
and the shared services + `docker-repo` registry are wired up — those
parts are inherited from prompd.app's setup.

```cmd
REM 1. Select the project
gcloud config set project prompd-io

REM 2. Confirm the shared registry is reachable
gcloud artifacts repositories describe docker-repo --location=us-central1

REM 3. Create / rotate Secret Manager values (interactive prompts)
deployment\setup-secrets.bat

REM 4. Grant the Cloud Run runtime SA secretAccessor on each new secret.
REM    Default SA: PROJECT_NUMBER-compute@developer.gserviceaccount.com
REM Path C launch — only the three secrets that exist. When upgrading to
REM path A (Clerk Pro + signed-in flow), add prmd-ai-clerk-secret,
REM prmd-ai-pushover-token, prmd-ai-pushover-user to the loop.
for /f "delims=" %%i in ('gcloud projects describe prompd-io --format="value(projectNumber)"') do set PN=%%i
for %%s in (prmd-ai-google-api-key prmd-ai-github-token prmd-ai-mongodb-uri) do (
  gcloud secrets add-iam-policy-binding %%s ^
    --member=serviceAccount:!PN!-compute@developer.gserviceaccount.com ^
    --role=roles/secretmanager.secretAccessor
)
```

## Deploy

Set the public Clerk key in the shell, then run the driver:

```cmd
set CLERK_PUBLISHABLE_KEY=pk_live_xxx
deployment\deploy.bat
```

That submits `api.cloudbuild.yaml` first, resolves the resulting service
URL, then submits `web.cloudbuild.yaml` with `_API_URL` substituted in.
Total ~6–8 min cold; subsequent deploys hit the npm install cache and
land in ~3–4 min.

## Submit a single side manually

```cmd
REM API only
gcloud builds submit --config deployment\api.cloudbuild.yaml

REM Web only — needs both substitutions
for /f "delims=" %%i in ('gcloud run services describe api-prmd-ai --region us-central1 --format="value(status.url)"') do set API_URL=%%i
gcloud builds submit --config deployment\web.cloudbuild.yaml ^
  --substitutions=_CLERK_PUBLISHABLE_KEY=%CLERK_PUBLISHABLE_KEY%,_API_URL=%API_URL%
```

## Custom domain

After the first successful deploy, map `prmd.ai` to the web service:

```cmd
gcloud run domain-mappings create --service prmd-ai --domain prmd.ai --region us-central1
```

That outputs the DNS records to add at your registrar. Propagation runs
5–60 min. The API stays on its `*.run.app` URL — it's only reached via
the web service's `/api/*` proxy, so no domain mapping is needed there.

## Rollback

```cmd
gcloud run revisions list --service prmd-ai --region us-central1
gcloud run services update-traffic prmd-ai --to-revisions REVISION-NAME=100 --region us-central1
```

Same shape for `api-prmd-ai`.

## Logs

```cmd
gcloud run services logs read api-prmd-ai --region us-central1 --limit 100
gcloud run services logs read prmd-ai     --region us-central1 --limit 100
```

## Cost shape

Both services are small (`512Mi/1CPU` API, `256Mi/1CPU` web) with
`--min-instances 0`, so they scale to zero when idle and stay inside
Cloud Run's free tier at launch traffic (2M req/mo). Bumpable knobs if
traffic warrants:

- API `--max-instances` (5) — peak concurrency ceiling
- API `--concurrency` (40) — requests per instance
- API `--memory` if Gemini responses or zip generation balloon

## Secret rotation

`--set-secrets ...:latest` means Cloud Run picks up new versions on the
next revision. To rotate without touching code:

```cmd
echo new_value | gcloud secrets versions add prmd-ai-clerk-secret --data-file=-
gcloud run services update api-prmd-ai --region us-central1
```

The trailing bare `update` forces a new revision that re-reads `:latest`.
