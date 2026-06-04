@echo off
REM Short script (~5s). Use with test-slow-a.bat to see which script the
REM save button exports when several are running at once.
echo ============ SCRIPT B START ============
for /L %%i in (1,1,5) do (
  echo B: step %%i / 5
  ping -n 2 127.0.0.1 >nul
)
echo ============ SCRIPT B DONE (exit 0) ============
exit /b 0
