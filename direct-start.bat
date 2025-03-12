@echo off
echo ======================================
echo Space Race Game Server - Direct Start
echo ======================================
echo.

:: Kill existing processes more selectively
echo Checking for previous game server processes...
for /f "tokens=1" %%p in ('wmic process where "name='node.exe' AND CommandLine LIKE '%%server.js%%'" get ProcessId 2^>nul ^| findstr /R "[0-9]"') do (
    echo Terminating process with PID: %%p
    taskkill /F /PID %%p
)

echo.
echo ======================================
echo Starting the game server...
echo.
echo Your game will be available at:
echo.
echo    http://localhost:3000
echo.
echo (If port 3000 is already in use, check below for the actual URL)
echo.
echo You should see "Server running on http://localhost:XXXX" below
echo when the server has successfully started.
echo.
echo Press Ctrl+C to stop the server when done.
echo ======================================
echo.

:: Set a special environment variable to prevent self-detection
set SKIP_PROCESS_CHECK=true

:: Start the server with the environment variable
node -e "process.env.SKIP_PROCESS_CHECK = 'true'; require('./server.js');" 