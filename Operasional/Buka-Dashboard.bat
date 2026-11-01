@echo off
setlocal
set "PORT=3000"
for /f "tokens=2 delims==" %%a in ('findstr /r /b /c:"PORT=" "%~dp0..\.env" 2^>nul') do set "PORT=%%a"
start "" "http://127.0.0.1:%PORT%/#/server"
