# Menyalakan backend LestariPangan di PC ini dan tunnel balik SSH ke VPS. Aman dijalankan berulang (komponen yang hidup dilewati).
# Pengaturan dibaca dari .env: LP_VPS_HOST (user@host), LP_SSH_KEY (jalur kunci), LP_REMOTE_PORT (bawaan 13400). Boleh juga lewat parameter.
param([string]$VpsHost, [string]$KeyPath, [int]$RemotePort = 0)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\common.ps1"
if (-not $VpsHost) { $VpsHost = Get-EnvValue 'LP_VPS_HOST' }
if (-not $KeyPath) { $KeyPath = Get-EnvValue 'LP_SSH_KEY' }
if (-not $RemotePort) { $RemotePort = [int](Get-EnvValue 'LP_REMOTE_PORT' '13400') }
$port = [int](Get-EnvValue 'PORT' '3000')
$logs = Join-Path $script:Root 'logs'; New-Item -ItemType Directory -Force $logs | Out-Null

# 1. Backend
if (Test-Listening $port) { "backend  : sudah berjalan (port $port)" }
else {
  Start-Process node -ArgumentList 'server/index.js' -WorkingDirectory $script:Root -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logs 'backend.out.log') -RedirectStandardError (Join-Path $logs 'backend.err.log')
  1..10 | ForEach-Object { if (-not (Test-Listening $port)) { Start-Sleep 1 } }
  "backend  : " + $(if (Test-Listening $port) { "hidup di port $port" } else { 'GAGAL, lihat logs\backend.err.log (jalankan: npm run check:env)' })
}

# 2. Tunnel balik: port $RemotePort di VPS (hanya loopback) diteruskan ke backend di PC ini
if (-not $VpsHost) { 'tunnel   : DILEWATI (isi LP_VPS_HOST di .env, mis. user@vps.contoh.id)' }
elseif (Get-TunnelProcs) { 'tunnel   : sudah berjalan' }
elseif (-not $KeyPath -or -not (Test-Path $KeyPath)) { 'tunnel   : DILEWATI (isi LP_SSH_KEY di .env dengan jalur kunci SSH yang ada)' }
else {
  $loop = "# lestari-tunnel`n" +
    "while (`$true) { & ssh -i '$KeyPath' -o BatchMode=yes -o ConnectTimeout=10 $VpsHost 'fuser -k ${RemotePort}/tcp >/dev/null 2>&1'; " +
    "& ssh -i '$KeyPath' -N -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=20 -o ServerAliveCountMax=3 " +
    "-R 127.0.0.1:${RemotePort}:127.0.0.1:${port} $VpsHost; Start-Sleep 10 }"
  Start-Process powershell -ArgumentList '-NoProfile', '-WindowStyle', 'Hidden', '-Command', $loop -WindowStyle Hidden
  Start-Sleep 4
  'tunnel   : dijalankan (tersambung ulang otomatis bila putus)'
}
