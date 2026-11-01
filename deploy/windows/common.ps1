# Fungsi bersama skrip operasional. Dipanggil dengan: . "$PSScriptRoot\common.ps1"
$script:Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
function Get-EnvValue([string]$Name, [string]$Default = '') {
  $v = [Environment]::GetEnvironmentVariable($Name); if ($v) { return $v }
  $f = Join-Path $script:Root '.env'
  if (Test-Path $f) { $m = Select-String -Path $f -Pattern ("^\s*" + [regex]::Escape($Name) + "\s*=\s*(.+?)\s*(#.*)?$") | Select-Object -First 1; if ($m -and $m.Matches[0].Groups[1].Value) { return $m.Matches[0].Groups[1].Value.Trim('"', "'") } }
  return $Default
}
function Test-Listening([int]$Port) { [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) }
function Get-TunnelProcs { Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match 'lestari-tunnel' } }
