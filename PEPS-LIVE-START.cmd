@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if not %errorlevel%==0 (
  echo PEPS LIVE needs Node.js 22.12 or newer.
  echo Opening the Node.js download page now.
  start "" "https://nodejs.org/en/download"
  echo.
  echo Install Node.js, then double-click this file again.
  pause
  exit /b 1
)
node -e "const [maj,min]=process.versions.node.split('.').map(Number); process.exit(maj>22 || (maj===22 && min>=12) ? 0 : 1)"
if not %errorlevel%==0 (
  echo PEPS LIVE needs Node.js 22.12 or newer. Current version:
  node -v
  echo.
  echo Opening the Node.js download page now.
  start "" "https://nodejs.org/en/download"
  echo.
  echo Install the latest LTS/Current Node.js, then double-click this file again.
  pause
  exit /b 1
)
node scripts\windows-start.cjs %*
if errorlevel 1 (
  echo.
  echo PEPS LIVE start failed. Check logs\windows-launcher-setup.log
  echo Press any key to close.
  pause >nul
)
endlocal
