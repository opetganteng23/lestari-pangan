# Fungsi bersama skrip operasional. Dipanggil dengan: . "$PSScriptRoot\common.ps1"
$script:Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$script:CfMetrics = '127.0.0.1:20491'   # penanda proses cloudflared milik LestariPangan
function Get-EnvValue([string]$Name, [string]$Default = '') {
  $v = [Environment]::GetEnvironmentVariable($Name); if ($v) { return $v }
  $f = Join-Path $script:Root '.env'
  if (Test-Path $f) { $m = Select-String -Path $f -Pattern ("^\s*" + [regex]::Escape($Name) + "\s*=\s*(.+?)\s*(#.*)?$") | Select-Object -First 1; if ($m -and $m.Matches[0].Groups[1].Value) { return $m.Matches[0].Groups[1].Value.Trim('"', "'") } }
  return $Default
}
function Test-Listening([int]$Port) { [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) }
function Get-SshTunnelProcs { Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match 'lestari-tunnel' } }
function Get-CfProcs { Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match [regex]::Escape($script:CfMetrics) } }
function Get-TailscaleExe { $g = Get-Command tailscale -ErrorAction SilentlyContinue; if ($g) { return $g.Source }; $p = 'C:Program FilesTailscale	ailscale.exe'; if (Test-Path $p) { return $p }; return $null }
function Get-TunnelMode { (Get-EnvValue 'LP_TUNNEL' 'none').ToLower() }
function Test-TunnelUp {
  switch (Get-TunnelMode) {
    'cloudflared' { return [bool](Get-CfProcs) }
    'ssh' { return [bool](Get-SshTunnelProcs) }
    'tailscale' { $ts = Get-TailscaleExe; if (-not $ts) { return $false }; return ((& $ts funnel status 2>&1 | Out-String) -match 'Funnel on') }
    default { return $false }
  }
}
