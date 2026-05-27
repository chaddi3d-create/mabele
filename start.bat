@echo off
cd /d "%~dp0"
where node >nul 2>&1
if %errorlevel%==0 (
  echo Starting MA BELLE server...
  call npm install
  call npm start
  pause
  exit /b
)
where py >nul 2>&1
if %errorlevel%==0 (
  echo Node.js not found. Starting static server on http://localhost:8080
  echo Install Node.js from https://nodejs.org for full admin API.
  start http://localhost:8080
  py -m http.server 8080 --directory public
  pause
  exit /b
)
echo Install Node.js https://nodejs.org OR Python for static preview.
echo You can also open public\index.html via Live Server in VS Code.
pause
