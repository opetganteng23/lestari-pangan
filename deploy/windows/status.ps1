# Memeriksa komponen LestariPangan di PC ini dan alamat publik (hanya membaca).
. "$PSScriptRoot\common.ps1"
$line = { param($name, $ok, $detail) '{0,-9}: {1}  {2}' -f $name, $(if ($ok) { 'HIDUP ' } else { 'MATI  ' }), $detail }
$port = [int](Get-EnvValue 'PORT' '3000')
$health = $null
try { $health = (Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$port/api/health" -TimeoutSec 4).Content } catch { }
& $line 'Backend' ([bool]$health) $(if ($health) { $health } else { "127.0.0.1:$port tidak menjawab (nyalakan: Nyalakan-LestariPangan.bat)" })
$tun = Get-TunnelProcs
& $line 'Tunnel' ([bool]$tun) $(if ($tun) { 'terhubung ke VPS (tersambung ulang otomatis)' } else { 'tidak berjalan; situs publik tidak dapat menjangkau backend' })
$api = Get-EnvValue 'LP_API_PUBLIC_URL'
if ($api) { $pub = $null; try { $pub = (Invoke-WebRequest -UseBasicParsing "$api/api/health" -TimeoutSec 8).Content } catch { }; & $line 'API publik' ([bool]$pub) $(if ($pub) { "$api -> $pub" } else { "$api/api/health tidak menjawab" }) }
$site = Get-EnvValue 'PUBLIC_URL'
if ($site -and $site -notmatch 'NAMA-PROYEK') { $pub = $null; try { $pub = (Invoke-WebRequest -UseBasicParsing "$site/api/health" -TimeoutSec 10).Content } catch { }; & $line 'Situs' ([bool]$pub) $(if ($pub) { "$site -> $pub" } else { "$site/api/health tidak menjawab (cek Vercel dan tunnel)" }) }
$key = Get-EnvValue 'ANTHROPIC_API_KEY'
"{0,-9}: {1}" -f 'AI', $(if ($key) { 'kunci Anthropic terisi (uji lewat dashboard Server)' } else { 'kunci belum diisi; jawaban berbasis aturan' })
$auto = [bool](Get-ScheduledTask -TaskName 'LestariPangan - Nyalakan layanan' -ErrorAction SilentlyContinue)
& $line 'Otomatis' $auto $(if ($auto) { 'menyala sendiri saat masuk Windows (batalkan: Batalkan-Otomatis.bat)' } else { 'belum aktif (aktifkan: Aktifkan-Otomatis.bat)' })
