# Menghentikan backend dan tunnel LestariPangan di PC ini. Hanya proses milik proyek ini yang disentuh.
. "$PSScriptRoot\common.ps1"
$n = 0
foreach ($l in @(Get-SshTunnelProcs)) { Get-CimInstance Win32_Process -Filter "ParentProcessId=$($l.ProcessId)" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Stop-Process -Id $l.ProcessId -Force -ErrorAction SilentlyContinue; $n++ }
foreach ($c in @(Get-CfProcs)) { Stop-Process -Id $c.ProcessId -Force -ErrorAction SilentlyContinue; $n++ }
if ((Get-TunnelMode) -eq 'tailscale' -and (Get-Command tailscale -ErrorAction SilentlyContinue)) { & tailscale funnel reset 2>&1 | Out-Null; $n++ }
"tunnel   : $(if ($n) { 'dihentikan' } else { 'tidak berjalan' })"
$port = [int](Get-EnvValue 'PORT' '3000')
$be = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | ForEach-Object { Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue } | Where-Object { $_.ProcessName -eq 'node' })
foreach ($p in $be) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
"backend  : $(if ($be.Count) { 'dihentikan' } else { 'tidak berjalan' })"
