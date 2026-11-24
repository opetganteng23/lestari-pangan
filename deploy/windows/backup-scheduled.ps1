# Cadangan terjadwal LestariPangan: menyalin data/ ke backups/ (atau LP_BACKUP_DIR) lalu menyisakan N cadangan terbaru.
# Dijalankan oleh tugas terjadwal (lihat install-backup-task.ps1), bisa juga dijalankan manual. Tidak butuh hak admin.
# Jumlah yang disimpan: LP_BACKUP_KEEP di .env (bawaan 14). Hasil dicatat di logs\backup.log.
$ErrorActionPreference = 'Continue'
. "$PSScriptRoot\common.ps1"
$keep = [int](Get-EnvValue 'LP_BACKUP_KEEP' '14')
$logDir = Join-Path $script:Root 'logs'; if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$log = Join-Path $logDir 'backup.log'
$node = (Get-Command node -ErrorAction SilentlyContinue)
if (-not $node) { Add-Content $log ("{0}  GAGAL: node tidak ditemukan di PATH" -f (Get-Date -Format 's')); exit 1 }
Push-Location $script:Root
try {
  $out = & $node.Source 'scripts\backup.js' '--keep' $keep 2>&1 | Out-String
  Add-Content $log ("{0}  {1}" -f (Get-Date -Format 's'), $out.Trim())
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally { Pop-Location }
