@echo off
echo Hello from BatRunner
echo Working dir: %CD%
echo This window stays open after the run.
ping -n 2 127.0.0.1 >nul
echo Done.
exit /b 0
