@echo off
echo Killing any Node.js processes running server.js...

:: Find and kill Node.js processes running server.js
for /f "tokens=1" %%p in ('wmic process where "name='node.exe' AND CommandLine LIKE '%%server.js%%'" get ProcessId /format:value ^| find "="') do (
    for /f "tokens=2 delims==" %%v in ("%%p") do (
        echo Terminating process with PID: %%v
        taskkill /F /PID %%v
    )
)

echo Done!
pause 