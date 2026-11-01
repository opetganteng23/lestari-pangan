@echo off
setlocal
set "WIN=%~dp0..\deploy\windows"
echo Mematikan backend dan tunnel LestariPangan.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%WIN%\stop.ps1"
echo.
pause
