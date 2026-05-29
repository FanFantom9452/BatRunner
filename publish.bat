@echo off
rem ===========================================================================
rem BatRunner - publish to the VS Code Marketplace
rem
rem PREREQUISITES (one-time):
rem   1. Create an Azure DevOps account: https://dev.azure.com
rem   2. Create a Marketplace publisher: https://marketplace.visualstudio.com/manage
rem   3. Create a Personal Access Token (PAT) with scope: Marketplace > Manage
rem   4. Change "publisher": "local" in package.json to your real publisher id.
rem   5. Set the token in this shell:  set VSCE_PAT=your_token_here
rem ===========================================================================
setlocal
cd /d "%~dp0"

if "%VSCE_PAT%"=="" (
  echo VSCE_PAT is not set.
  echo Run:  set VSCE_PAT=your_personal_access_token
  echo Then run this script again.
  exit /b 1
)

echo === BatRunner: publishing to Marketplace ===
call npx vsce publish -p %VSCE_PAT%
if errorlevel 1 goto :error

echo.
echo Published.
exit /b 0

:error
echo.
echo Publish FAILED (errorlevel %errorlevel%).
echo Common causes: publisher id still "local", PAT expired/wrong scope, or
echo missing required fields (icon/repository) for Marketplace.
exit /b 1
