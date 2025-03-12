@echo off
echo ======================================
echo Space Race Game Server
echo ======================================
echo.

:: Kill any existing node.exe processes (could be problematic if other Node apps are running)
echo Killing any existing Node.js processes...
taskkill /F /IM node.exe 2>nul
if %ERRORLEVEL% EQU 0 (
  echo Terminated existing Node.js processes.
  timeout /t 1 > nul
) else (
  echo No Node.js processes were found.
)

echo.
echo Starting the game server...
echo.
echo Once the server is running, you can play the game at:
echo.
echo    http://localhost:3000
echo.
echo (If port 3000 is already in use, check the console output for the actual URL)
echo.
echo ======================================
echo.

:: Start the server
node server.js

:: This will keep the window open after the server exits
echo.
echo ======================================
echo Server has stopped. Press any key to exit.
pause > nul 