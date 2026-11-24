# Mendaftarkan tugas terjadwal cadangan harian (bawaan pukul 02:00). Tidak butuh hak admin; berjalan sebagai akun Anda.
# Pakai: .\install-backup-task.ps1 [-Jam 02:00]   · Hapus: .\uninstall-backup-task.ps1 · Cek hasil: logs\backup.log
param([string]$Jam = '02:00')
$ErrorActionPreference = 'Stop'
if ($Jam -notmatch '^([01]\d|2[0-3]):[0-5]\d$') { throw "Format jam harus HH:mm (24 jam), mis. 02:00. Diberikan: $Jam" }
$script = Join-Path $PSScriptRoot 'backup-scheduled.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
$trigger = New-ScheduledTaskTrigger -Daily -At $Jam
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName 'LestariPangan - Cadangan harian' -Action $action -Trigger $trigger -Settings $settings -Description 'Menyalin data LestariPangan ke folder backups dan menyisakan cadangan terbaru' -Force | Out-Null
"Aktif: cadangan harian pukul $Jam. 'StartWhenAvailable' membuat cadangan yang terlewat (PC mati) dijalankan saat PC menyala lagi."
'Jumlah cadangan yang disimpan diatur LP_BACKUP_KEEP di .env (bawaan 14). Letakkan LP_BACKUP_DIR di drive lain bila bisa.'
