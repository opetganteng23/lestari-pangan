@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\deploy\windows\uninstall-autostart.ps1"
echo.
pause
