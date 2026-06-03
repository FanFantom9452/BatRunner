@echo off
REM ============================================================
REM  BatRunner test: EXTERNAL mode (real console required).
REM  Uses timeout / start / pause -- these need a real console
REM  and FAIL under integrated capture (stdin is a pipe).
REM
REM  Run this via Command Palette > "BatRunner: Run in External CMD"
REM  (or set batRunner.terminalMode = external).
REM  In external mode all three commands work. In integrated mode
REM  you will see: "ERROR: Input redirection is not supported".
REM ============================================================
echo === BatRunner external-mode test ===
echo.
echo [1/3] timeout: waiting 3 seconds...
timeout /t 3 /nobreak
echo.
echo [2/3] start: opening a child window...
start "BatRunner child" cmd /k echo This child window proves start works. Close me.
echo.
echo [3/3] pause: press any key to finish...
pause
echo Done.
exit /b 0
