@echo off
REM Long script (~12s). Use with test-slow-b.bat to see which script the
REM save button exports when several are running at once.
echo ============ SCRIPT A START ============
for /L %%i in (1,1,12) do (
  echo A: step %%i / 12
  ping -n 2 127.0.0.1 >nul
)
echo ============ SCRIPT A DONE (exit 0) ============
exit /b 0
