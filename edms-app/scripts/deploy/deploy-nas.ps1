# Deploy build Next.js standalone terbaru ke QNAP NAS:
#   1) Cek build lokal (.next/standalone)
#   2) Backup folder app + dump DB (lewati dengan -SkipBackup)
#   3) Sinkronkan payload ke <ShareRoot>\edms-app
#   4) Verifikasi BUILD_ID cocok
# PENTING: setelah script sukses, restart container 'edms-ups-app' di Container Station.
# Pemakaian: powershell -File scripts\deploy\deploy-nas.ps1 [-SkipBackup]
param(
  [switch]$SkipBackup,
  [string]$ShareRoot = '\\10.10.200.166\Container',
  [string]$SourceName = 'edms-app'
)
$ErrorActionPreference = 'Stop'

$appRoot   = Split-Path $PSScriptRoot -Parent | Split-Path -Parent   # .../edms-app
$standalone = Join-Path $appRoot '.next\standalone'
$localNext  = Join-Path $appRoot '.next'
$dst        = Join-Path $ShareRoot $SourceName

# -- 1. Cek build ------------------------------------------------
if (!(Test-Path -LiteralPath (Join-Path $standalone 'server.js'))) {
  throw "Build standalone belum ada. Jalankan dulu: npm run build"
}
if (!(Test-Path -LiteralPath $dst)) {
  throw "Folder tujuan tidak ditemukan: $dst"
}

# -- 2. Lengkapi payload (Next tidak selalu ikut menyalin static/public) --
$payloadStatic = Join-Path $standalone '.next\static'
if (!(Test-Path -LiteralPath $payloadStatic)) {
  Write-Host 'Menyiapkan .next/static ke payload...'
  $null = robocopy (Join-Path $localNext 'static') $payloadStatic /E /R:2 /W:2 /NFL /NDL /NJH /NP
  if ($LASTEXITCODE -ge 8) { throw "robocopy static gagal (exit $LASTEXITCODE)" }
}
# public: bangun ulang dari public lokal TANPA uploads - build ikut menyalin
# uploads lokal yang BUKAN data produksi; uploads hidup hanya ada di NAS.
$payloadPublic = Join-Path $standalone 'public'
if (Test-Path -LiteralPath $payloadPublic) {
  Remove-Item -LiteralPath $payloadPublic -Recurse -Force
}
Write-Host 'Menyiapkan public/ ke payload (tanpa uploads)...'
$null = robocopy (Join-Path $appRoot 'public') $payloadPublic /E /XD 'uploads' /R:2 /W:2 /NFL /NDL /NJH /NP
if ($LASTEXITCODE -ge 8) { throw "robocopy public payload gagal (exit $LASTEXITCODE)" }

$localBuildId = (Get-Content -LiteralPath (Join-Path $payloadStatic '..\BUILD_ID') -Raw).Trim()
Write-Host "Build lokal  : $localBuildId"

# -- 3. Backup (default) -----------------------------------------
if (-not $SkipBackup) {
  Write-Host '== Backup sebelum deploy =='
  & (Join-Path $PSScriptRoot 'backup-nas.ps1') -ShareRoot $ShareRoot -SourceName $SourceName
}

# -- 4. Sinkron payload terpilih -> NAS --------------------------
# Hanya item runtime + sql migrasi. Sengaja TIDAK disalin: .env.local,
# cookies.txt, storage (volume terpisah), zip arsip, log, .import-report.
Write-Host '== Sinkron payload ke NAS =='
function Sync-Item([string]$srcPath, [string]$dstDir, [switch]$Mirror) {
  if (!(Test-Path -LiteralPath $srcPath)) { throw "Item payload tidak ada: $srcPath" }
  $rcArgs = @('/R:3', '/W:3', '/NFL', '/NDL', '/NJH', '/NP')
  if (Test-Path -LiteralPath $srcPath -PathType Container) {
    if ($Mirror) { $rcArgs += '/MIR' } else { $rcArgs += '/E' }
    $null = robocopy $srcPath $dstDir @rcArgs
  } else {
    $null = robocopy (Split-Path $srcPath -Parent) $dstDir (Split-Path $srcPath -Leaf) @rcArgs
  }
  if ($LASTEXITCODE -ge 8) { throw "robocopy gagal untuk $srcPath (exit $LASTEXITCODE)" }
}
# .next di-MIR agar tidak ada manifest/chunk basi; lainnya ditimpa (/E)
Sync-Item (Join-Path $standalone 'server.js')     $dst
Sync-Item (Join-Path $standalone '.next')         (Join-Path $dst '.next') -Mirror
Sync-Item (Join-Path $standalone 'node_modules')  (Join-Path $dst 'node_modules')
Sync-Item (Join-Path $standalone 'public')        (Join-Path $dst 'public')
Sync-Item (Join-Path $standalone 'package.json')  $dst
Sync-Item (Join-Path $appRoot 'sql')              (Join-Path $dst 'sql')
Sync-Item (Join-Path $appRoot 'scripts')          (Join-Path $dst 'scripts')

# -- 5. Verifikasi -----------------------------------------------
$remoteBuildId = (Get-Content -LiteralPath (Join-Path $dst '.next\BUILD_ID') -Raw).Trim()
if ($remoteBuildId -ne $localBuildId) {
  throw "Verifikasi gagal: BUILD_ID NAS ($remoteBuildId) != lokal ($localBuildId)"
}
$remoteServer = Get-Item -LiteralPath (Join-Path $dst 'server.js')
Write-Host "BUILD_ID NAS : $remoteBuildId"
Write-Host "server.js NAS: $($remoteServer.LastWriteTime) ($([math]::Round($remoteServer.Length/1KB,1)) KB)"
Write-Host ''
Write-Host "DEPLOY_OK - file sudah tersinkron ke $dst"
Write-Host 'Langkah TERAKHIR: restart container edms-ups-app di Container Station'
Write-Host '  (Applications/Compose -> edms-mutu-system -> container edms-ups-app -> Restart),'
Write-Host '  atau via tab Containers -> klik kanan edms-ups-app -> Restart.'
