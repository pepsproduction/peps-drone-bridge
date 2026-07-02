@echo off
setlocal
net session >nul 2>&1
if not %errorlevel%==0 (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

netsh advfirewall firewall add rule name="PEPS LIVE Drone RTMP Bridge 1935" dir=in action=allow protocol=TCP localport=1935
echo.
echo Firewall rule for TCP 1935 is ready.
echo Press any key to close.
pause >nul
endlocal
