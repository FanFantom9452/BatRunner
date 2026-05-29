@echo off
rem ===========================================================================
rem BatRunner - one-shot packaging
rem Produces batrunner-<version>.vsix in this folder.
rem `vsce package` auto-runs the `vscode:prepublish` script (esbuild --production),
rem so the production bundle is rebuilt before packaging.
rem ===========================================================================
setlocal
cd /d "%~dp0"

echo === BatRunner: packaging .vsix ===

echo [1/2] Installing dependencies...
call npm install
if errorlevel 1 goto :error

echo [2/2] Building .vsix with vsce...
call npx vsce package
if errorlevel 1 goto :error

echo.
echo Done. Created:
dir /b *.vsix
echo.
echo Install it with:  code --install-extension batrunner-0.1.0.vsix
exit /b 0

:error
echo.
echo Packaging FAILED (errorlevel %errorlevel%).
exit /b 1
