# Menghapus tugas terjadwal cadangan harian LestariPangan (cadangan yang sudah ada tidak dihapus).
$ErrorActionPreference = 'Stop'
if (Get-ScheduledTask -TaskName 'LestariPangan - Cadangan harian' -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName 'LestariPangan - Cadangan harian' -Confirm:$false; 'Tugas cadangan harian dihapus.'
} else { 'Tugas cadangan harian tidak terdaftar.' }
