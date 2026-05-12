@echo off
REM prmd.ai Cloud Run deployment driver (Windows).
REM Deploys into the shared prompd-io GCP project alongside prompd.app and
REM the prompd.io marketing site.
REM
REM Submits both Cloud Build pipelines in order:
REM   1. api-prmd-ai  (Express API)
REM   2. prmd-ai      (nginx + Vite SPA, proxies /api to the API service URL)
REM
REM Requires:
REM   - gcloud CLI installed, authenticated
REM   - Secret Manager secrets prmd-ai-clerk-secret, prmd-ai-google-api-key,
REM     prmd-ai-github-token (create them with setup-secrets.bat)
REM   - Env var CLERK_PUBLISHABLE_KEY (pk_live_*) set in this shell
REM
REM Usage: deployment\deploy.bat

setlocal enabledelayedexpansion

set PROJECT_ID=prompd-io
set REGION=us-central1
set API_SERVICE=api-prmd-ai
set WEB_SERVICE=prmd-ai

echo.
echo ======================================
echo   Deploying prmd.ai to Cloud Run
echo   Project: %PROJECT_ID%
echo ======================================
echo.

where gcloud >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: gcloud CLI is not installed.
    echo Install from: https://cloud.google.com/sdk/docs/install
    exit /b 1
)

if "%CLERK_PUBLISHABLE_KEY%"=="" (
    echo NOTE: CLERK_PUBLISHABLE_KEY not set. Deploying in anon-only mode ^(path C^).
    echo URL flow will be open to anonymous users at 5/hr per IP.
    echo To enable Clerk auth, re-run with:  set CLERK_PUBLISHABLE_KEY=pk_live_...
    echo.
)

echo Setting project to: %PROJECT_ID%
gcloud config set project %PROJECT_ID%
if %ERRORLEVEL% neq 0 exit /b 1

echo.
echo --- Step 1/2: build and deploy API ---
gcloud builds submit --config deployment\api.cloudbuild.yaml
if %ERRORLEVEL% neq 0 (
    echo ERROR: API deployment failed.
    exit /b 1
)

echo.
echo Resolving API service URL...
for /f "delims=" %%i in ('gcloud run services describe %API_SERVICE% --region %REGION% --format "value(status.url)"') do set API_URL=%%i
if "%API_URL%"=="" (
    echo ERROR: could not resolve API service URL after deploy.
    exit /b 1
)
echo API URL: %API_URL%

echo.
echo --- Step 2/2: build and deploy web ---
gcloud builds submit --config deployment\web.cloudbuild.yaml ^
    --substitutions=_CLERK_PUBLISHABLE_KEY=%CLERK_PUBLISHABLE_KEY%,_API_URL=%API_URL%
if %ERRORLEVEL% neq 0 (
    echo ERROR: web deployment failed.
    exit /b 1
)

echo.
echo Resolving web service URL...
for /f "delims=" %%i in ('gcloud run services describe %WEB_SERVICE% --region %REGION% --format "value(status.url)"') do set WEB_URL=%%i

echo.
echo ======================================
echo   Deployment complete
echo ======================================
echo.
echo API: %API_URL%
echo Web: %WEB_URL%
echo.
echo Next steps:
echo   1. Visit %WEB_URL% to verify
echo   2. Map custom domain:
echo        gcloud run domain-mappings create --service %WEB_SERVICE% --domain prmd.ai --region %REGION%
echo.

endlocal
