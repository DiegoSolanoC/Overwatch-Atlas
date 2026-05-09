@echo off
echo Starting Overwatch Atlas Server...
echo.

REM Change to the script's directory (where the .bat file is)
cd /d "%~dp0"

REM Check Node is available
where node >nul 2>nul
if errorlevel 1 (
    echo Node.js not found. Please install Node.js and add it to PATH.
    pause
    exit /b 1
)

REM Generate manifest
echo Generating manifest...
call node scripts/generate-manifest.js
if errorlevel 1 (
    echo Error generating manifest!
    pause
    exit /b 1
)

REM Kill any existing process listening on :8000 (prevents stale server.js from staying alive)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo Found an existing server on port 8000 - PID %%p - stopping it...
    taskkill /F /PID %%p >nul 2>nul
)

REM Start server in a new cmd window (cwd is already %~dp0 from above)
echo Starting server...
start "Overwatch Atlas Server" cmd /k "node src\server.js"

REM Wait for server to be ready (5 seconds so port 8000 is listening)
echo Waiting for server to start...
timeout /t 5 /nobreak >nul

REM Open Chrome (use default browser if chrome.exe not in PATH)
echo Opening Chrome...
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "http://localhost:8000"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "http://localhost:8000"
) else (
    start "" "http://localhost:8000"
)

echo.
echo If Chrome shows "connection refused", check the "Overwatch Atlas Server" window for errors.
echo Server runs at http://localhost:8000 - you can also open that in your browser manually.
echo.
pause
