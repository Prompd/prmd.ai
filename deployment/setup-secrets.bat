@echo off
REM Creates / updates the Secret Manager secrets that api-prmd-ai consumes.
REM Run once on the prompd-io GCP project, then again any time a key rotates.
REM
REM Path C launch (anon-only) — three secrets required:
REM   prmd-ai-google-api-key  — Gemini key from aistudio.google.com/apikey
REM   prmd-ai-github-token    — PAT with public_repo scope
REM   prmd-ai-mongodb-uri     — Mongo connection string (mongodb+srv://...)
REM
REM When upgrading to Clerk Pro + path A (signed-in URL flow, feedback widget,
REM Pushover notifications), create these too and uncomment the matching
REM lines in deployment/api.cloudbuild.yaml's --set-secrets list:
REM   prmd-ai-clerk-secret    — sk_live_... from Clerk dashboard
REM   prmd-ai-pushover-token  — Pushover application token (optional)
REM   prmd-ai-pushover-user   — Pushover user/group key (optional)
REM
REM After this script runs, grant the runtime SA secretAccessor on each
REM (Secret Manager IAM) — see deployment/README.md for the one-liner.

setlocal enabledelayedexpansion

echo Setting up GCP secrets for api-prmd-ai (path C: anon-only launch)
echo.
echo Current project:
gcloud config get-value project
echo.
echo This script will prompt you for each secret value.
echo Press Ctrl+C to cancel at any time.
echo.
pause

:: Google AI Studio (Gemini) key
echo.
echo === Google AI Studio key (Gemini) ===
echo Enter your Gemini API key (AIza...)
set /p GOOGLE_KEY="GOOGLE_API_KEY: "
echo %GOOGLE_KEY%| gcloud secrets create prmd-ai-google-api-key --data-file=- 2>nul || echo %GOOGLE_KEY%| gcloud secrets versions add prmd-ai-google-api-key --data-file=-
echo Done.

:: GitHub PAT
echo.
echo === GitHub personal access token ===
echo Enter your GitHub PAT (github_pat_... or ghp_...)
set /p GITHUB_TOKEN_VALUE="GITHUB_TOKEN: "
echo %GITHUB_TOKEN_VALUE%| gcloud secrets create prmd-ai-github-token --data-file=- 2>nul || echo %GITHUB_TOKEN_VALUE%| gcloud secrets versions add prmd-ai-github-token --data-file=-
echo Done.

:: MongoDB connection string
echo.
echo === MongoDB connection string ===
echo Enter the connection string for the prmd-ai database
echo Format: mongodb+srv://user:pass@host/prmd-ai?retryWrites=true^&w=majority
set /p MONGO_URI="MONGODB_URI: "
echo %MONGO_URI%| gcloud secrets create prmd-ai-mongodb-uri --data-file=- 2>nul || echo %MONGO_URI%| gcloud secrets versions add prmd-ai-mongodb-uri --data-file=-
echo Done.

echo.
echo === Path C secrets created ===
echo.
echo Verify:
gcloud secrets list --filter="name:prmd-ai-*"
echo.
echo Next: grant secretAccessor IAM on each — see deployment/README.md.

endlocal
