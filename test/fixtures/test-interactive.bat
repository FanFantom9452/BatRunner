@echo off
REM ============================================================
REM  BatRunner test: INTERACTIVE input (integrated mode).
REM  Proves set /p, choice and pause work in the shell-integration
REM  terminal. Press the play button, click the terminal panel,
REM  then type.
REM ============================================================
echo === BatRunner interactive test ===
echo.
set /p name=Type your name then press Enter:
echo Hello, %name%!
echo.
choice /c 12 /m "Pick 1 or 2"
echo You picked option %errorlevel%.
echo.
echo Press any key to finish...
pause >nul
echo Done. Now click the save button to export this session.
exit /b 0
