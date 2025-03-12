@echo off
echo ======================================
echo Space Race - Additional Server Instance
echo ======================================
echo.
echo This script will start another server instance without
echo terminating existing servers. Each server will use a different port.
echo.
echo Would you like to proceed? (Y/N)
set /p confirm=

if /i "%confirm%" neq "Y" (
    echo Operation cancelled.
    exit /b
)

echo.
echo Starting additional server instance...
echo.
echo The new game server will be available at a different port
echo than your existing server(s).
echo.
echo You should see "Server running on http://localhost:XXXX" below
echo when the server has successfully started.
echo.
echo Press Ctrl+C to stop this server when done.
echo ======================================
echo.

:: Set environment variables to prevent killing other processes
set SKIP_PROCESS_CHECK=true
set ALLOW_MULTIPLE_SERVERS=true

:: Start a new server instance with environment variables
:: The server will automatically select a different port
node -e "process.env.SKIP_PROCESS_CHECK = 'true'; process.env.ALLOW_MULTIPLE_SERVERS = 'true'; require('./server.js');"

echo.
echo ======================================
echo Server has stopped. Press any key to exit.
pause > nul 