# Rollback folder app NAS ke backup hasil backup-nas.ps1.
# File dipulihkan MENIMPA file yang ada (tanpa menghapus file lain).
# PENTING: setelah rollback, restart container edms-ups-app via Container Station.
# Pemakaian:
#   powershell -File scripts\deploy\rollback-nas.ps1                 # backup terbaru
#   powershell -File scripts\deploy\rollback-nas.ps1 -Backup edms-app-backup-20261001-101500
param(
  [string]$Backup = '',
  [string]$ShareRoot = '\\10.10.200.166\Container',
  [string]$SourceName = 'edms-app'
)
$ErrorActionPreference = 'Stop'

$app = Join-Path $ShareRoot $SourceName
if (!(Test-Path -LiteralPath $app)) { throw "Folder app tidak ditemukan: $app" }

if (-not $Backup) {
  $latest = Get-ChildItem -LiteralPath $ShareRoot -Directory -Filter "$SourceName-backup-*" |
    Sort-Object Name -Descending | Select-Object -First 1
  if (-not $latest) { throw "Tidak ada folder backup $SourceName-backup-* di $ShareRoot" }
  $backupPath = $latest.FullName
} elseif ([System.IO.Path]::IsPathRooted($Backup)) {
  $backupPath = $Backup
} else {
  $backupPath = Join-Path $ShareRoot $Backup
}

if (!(Test-Path -LiteralPath (Join-Path $backupPath 'server.js'))) {
  throw "Bukan folder backup valid (server.js tidak ada): $backupPath"
}

Write-Host "ROLLBACK dari: $backupPath"
Write-Host "ROLLBACK ke   : $app"

# Pulihkan semua file backup menimpa isi app (file baru yang tidak ada di backup dibiarkan — tidak berbahaya)
$null = robocopy $backupPath $app /E /R:2 /W:2 /NFL /NDL /NJH /NP
if ($LASTEXITCODE -ge 8) { throw "robocopy rollback gagal (exit $LASTEXITCODE)" }

$localServer = Get-Item -LiteralPath (Join-Path $app 'server.js')
$backupServer = Get-Item -LiteralPath (Join-Path $backupPath 'server.js')
if ($localServer.LastWriteTime -ne $backupServer.LastWriteTime) {
  throw "Verifikasi gagal: server.js tidak sama dengan backup"
}

Write-Host "ROLLBACK_OK server.js -> $($localServer.LastWriteTime)"
Write-Host "SEKARANG restart container 'edms-ups-app' di Container Station agar versi lama aktif kembali."
