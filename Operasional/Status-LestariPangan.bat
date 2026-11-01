@echo off
setlocal
set "WIN=%~dp0..\deploy\windows"
powershell -NoProfile -ExecutionPolicy Bypass -File "%WIN%\status.ps1"
echo.
pause
