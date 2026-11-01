@echo off
setlocal
set "WIN=%~dp0..\deploy\windows"
echo Menyalakan LestariPangan (backend dan tunnel)...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%WIN%\start.ps1"
echo.
echo Memeriksa status...
powershell -NoProfile -ExecutionPolicy Bypass -File "%WIN%\status.ps1"
echo.
pause
