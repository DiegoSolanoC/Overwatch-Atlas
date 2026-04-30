# PowerShell script to start Overwatch Atlas server and open in Chrome
Write-Host "Starting Overwatch Atlas Server..." -ForegroundColor Green
Write-Host ""

# Change to script directory
Set-Location $PSScriptRoot

# Generate manifest
Write-Host "Generating manifest..." -ForegroundColor Yellow
node generate-manifest.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error generating manifest!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Start server in new window
Write-Host "Starting server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; node server.js" -WindowStyle Normal

# Wait for server to start
Write-Host "Waiting for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Open Chrome
Write-Host "Opening Chrome..." -ForegroundColor Yellow
Start-Process "chrome.exe" -ArgumentList "http://localhost:8000"

Write-Host ""
Write-Host "Server is running! The server window will stay open." -ForegroundColor Green
Write-Host "Close the server window to stop the server." -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to exit this window (server will keep running)"
