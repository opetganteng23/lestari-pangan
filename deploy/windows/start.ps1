# Menyalakan backend LestariPangan di PC ini dan tunnel agar bisa dijangkau Vercel. Aman dijalankan berulang.
# Pilih jenis tunnel di .env:  LP_TUNNEL=cloudflared | tailscale | ssh | none   (lihat docs/deploy-vercel.md)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\common.ps1"
$port = [int](Get-EnvValue 'PORT' '3000'); $mode = Get-TunnelMode
$logs = Join-Path $script:Root 'logs'; New-Item -ItemType Directory -Force $logs | Out-Null

# 1. Backend
if (Test-Listening $port) { "backend  : sudah berjalan (port $port)" }
else {
  Start-Process node -ArgumentList 'server/index.js' -WorkingDirectory $script:Root -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logs 'backend.out.log') -RedirectStandardError (Join-Path $logs 'backend.err.log')
  1..10 | ForEach-Object { if (-not (Test-Listening $port)) { Start-Sleep 1 } }
  "backend  : " + $(if (Test-Listening $port) { "hidup di port $port" } else { 'GAGAL, lihat logs\backend.err.log (jalankan: npm run check:env)' })
}

# 2. Tunnel
if (Test-TunnelUp) { "tunnel   : sudah berjalan ($mode)" }
else {
  switch ($mode) {
    'cloudflared' {
      $token = Get-EnvValue 'LP_CF_TUNNEL_TOKEN'
      if (-not $token) { 'tunnel   : DILEWATI (isi LP_CF_TUNNEL_TOKEN di .env; lihat docs/deploy-vercel.md)'; break }
      if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) { 'tunnel   : DILEWATI (cloudflared belum terpasang)'; break }
      $env:TUNNEL_TOKEN = $token   # lewat variabel lingkungan agar token tidak tampak di daftar proses
      Start-Process cloudflared -ArgumentList 'tunnel', '--no-autoupdate', '--metrics', $script:CfMetrics, 'run' -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $logs 'tunnel.out.log') -RedirectStandardError (Join-Path $logs 'tunnel.err.log')
      Remove-Item Env:TUNNEL_TOKEN; Start-Sleep 5
      'tunnel   : cloudflared dijalankan (hostname diatur di dasbor Cloudflare)'
    }
    'tailscale' {
      $ts = Get-TailscaleExe; if (-not $ts) { 'tunnel   : DILEWATI (Tailscale belum terpasang)'; break }
      & $ts funnel --bg $port 2>&1 | ForEach-Object { "tunnel   : $_" }
    }
    'ssh' {
      $vps = Get-EnvValue 'LP_VPS_HOST'; $key = Get-EnvValue 'LP_SSH_KEY'; $rp = [int](Get-EnvValue 'LP_REMOTE_PORT' '13400')
      if (-not $vps -or -not $key -or -not (Test-Path $key)) { 'tunnel   : DILEWATI (isi LP_VPS_HOST dan LP_SSH_KEY yang ada)'; break }
      $loop = "# lestari-tunnel`n" +
        "while (`$true) { & ssh -i '$key' -o BatchMode=yes -o ConnectTimeout=10 $vps 'fuser -k ${rp}/tcp >/dev/null 2>&1'; " +
        "& ssh -i '$key' -N -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=20 -o ServerAliveCountMax=3 -R 127.0.0.1:${rp}:127.0.0.1:${port} $vps; Start-Sleep 10 }"
      Start-Process powershell -ArgumentList '-NoProfile', '-WindowStyle', 'Hidden', '-Command', $loop -WindowStyle Hidden; Start-Sleep 4
      'tunnel   : ssh dijalankan (tersambung ulang otomatis)'
    }
    default { 'tunnel   : tidak dipakai (LP_TUNNEL=none); situs Vercel tidak bisa menjangkau backend ini' }
  }
}
