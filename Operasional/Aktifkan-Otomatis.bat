@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\deploy\windows\install-autostart.ps1"
echo.
pause
