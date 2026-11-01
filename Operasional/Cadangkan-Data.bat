@echo off
setlocal
cd /d "%~dp0.."
echo Mencadangkan data LestariPangan ke folder backups...
echo.
node scripts\backup.js
echo.
pause
