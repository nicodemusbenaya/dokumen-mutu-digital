# Backup sebelum deploy ke QNAP:
#   1) Salin folder app di NAS  -> <ShareRoot>\edms-app-backup-<timestamp>
#   2) Dump database edms_ups    -> <backup>\edms_ups.sql
# Pemakaian: powershell -File scripts\deploy\backup-nas.ps1 [-ShareRoot '\\10.10.200.166\Container']
param(
  [string]$ShareRoot = '\\10.10.200.166\Container',
  [string]$SourceName = 'edms-app'
)
$ErrorActionPreference = 'Stop'

$src = Join-Path $ShareRoot $SourceName
if (!(Test-Path -LiteralPath $src)) { throw "Folder sumber tidak ditemukan: $src" }

$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$dst = Join-Path $ShareRoot "$SourceName-backup-$ts"
Write-Host "BACKUP mulai : $src"
Write-Host "BACKUP tujuan: $dst"

# Salin isi folder app (kecuali zip bundle lama yang sudah jadi arsip tersendiri)
$null = robocopy $src $dst /E /XF 'edms-standalone-qnap.zip' /R:2 /W:2 /NFL /NDL /NJH /NP
if ($LASTEXITCODE -ge 8) { throw "robocopy folder app gagal (exit $LASTEXITCODE)" }

# Dump database ke dalam folder backup yang sama
$dumpScript = Join-Path $PSScriptRoot 'dump-db.mjs'
node $dumpScript (Join-Path $dst 'edms_ups.sql')
if ($LASTEXITCODE -ne 0) { throw "Dump database gagal (exit $LASTEXITCODE)" }

$sizeMB = [math]::Round(((Get-ChildItem -LiteralPath $dst -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Sum Length).Sum / 1MB), 1)
Write-Host "BACKUP_OK $dst ($sizeMB MB)"
Write-Host "Rollback memakai: powershell -File scripts\deploy\rollback-nas.ps1 -Backup '$(Split-Path $dst -Leaf)'"
