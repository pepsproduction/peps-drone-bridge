@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if not %errorlevel%==0 (
  echo Node.js was not found. No PEPS LIVE Node server can be stopped from this shortcut.
  echo Press any key to close.
  pause >nul
  exit /b 1
)
node scripts\windows-stop.cjs %*
if errorlevel 1 (
  echo.
  echo PEPS LIVE stop failed. Press any key to close.
  pause >nul
)
endlocal
