# Menghentikan backend dan tunnel LestariPangan di PC ini. Hanya proses milik proyek ini yang disentuh.
. "$PSScriptRoot\common.ps1"
$loops = @(Get-TunnelProcs)
foreach ($l in $loops) {
  Get-CimInstance Win32_Process -Filter "ParentProcessId=$($l.ProcessId)" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Stop-Process -Id $l.ProcessId -Force -ErrorAction SilentlyContinue
}
"tunnel   : $(if ($loops.Count) { 'dihentikan' } else { 'tidak berjalan' })"
$port = [int](Get-EnvValue 'PORT' '3000')
$be = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | ForEach-Object { Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue } | Where-Object { $_.ProcessName -eq 'node' })
foreach ($p in $be) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
"backend  : $(if ($be.Count) { 'dihentikan' } else { 'tidak berjalan' })"
