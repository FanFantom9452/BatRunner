@echo off
REM ============================================================
REM  BatRunner test: INTEGRATED mode (the default play button).
REM  Pure data output, no console-only commands -> capture + 7
REM  export works, and the terminal stays open after exit.
REM  Run with the play button, then test the save/export button.
REM ============================================================
echo === BatRunner capture test ===
echo Line 1: hello world
echo Line 2: data,row,123,ok
echo Line 3: another,row,456,ok

REM ping = a delay that WORKS under piped stdin (timeout does not).
echo Waiting ~1s (ping trick)...
ping -n 2 127.0.0.1 >nul

echo Line 4: done after the wait
echo Finished. Exit code should be 0.
exit /b 0
