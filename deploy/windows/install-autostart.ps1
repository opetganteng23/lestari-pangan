# Mendaftarkan tugas terjadwal: LestariPangan menyala sendiri saat Anda masuk ke Windows. Tidak butuh hak admin.
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'start.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName 'LestariPangan - Nyalakan layanan' -Action $action -Trigger $trigger -Settings $settings -Description 'Menyalakan backend dan tunnel LestariPangan saat masuk Windows' -Force | Out-Null
'Aktif: LestariPangan akan menyala sendiri setiap kali Anda masuk ke Windows.'
'Pastikan Windows tidak otomatis Sleep (Pengaturan > Daya) agar situs tetap terjangkau.'
