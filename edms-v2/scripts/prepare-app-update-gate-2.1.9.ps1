param(
  [Parameter(Mandatory=$true)][string]$Backup,
  [Parameter(Mandatory=$true)][string]$RestoreReport,
  [string]$Package=(Join-Path $PSScriptRoot '../release/app-update-2.1.9')
)
$ErrorActionPreference='Stop'
function Get-Sha256([string]$Path){
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}
$backupPath=(Resolve-Path -LiteralPath $Backup).ProviderPath
$packagePath=(Resolve-Path -LiteralPath $Package).ProviderPath
$report=Get-Content -LiteralPath $RestoreReport -Raw | ConvertFrom-Json
if($report.testRun -notmatch '^DUMMY-RESTORE-[a-f0-9]{12}$' -or $report.passed -ne $true -or $report.productionTouched -ne $false -or $report.backupChecksums -ne $true -or $report.databaseRestoreVerified -ne $true -or $report.storageBackupVerified -ne $true -or $report.composeRestoreVerified -ne $true -or $report.restoreVerified -ne $true){throw 'Restore report does not prove a complete, successful, production-isolated restore.'}
$backupManifest=Join-Path $backupPath 'SHA256SUMS'
$backupState=Get-Content -LiteralPath (Join-Path $backupPath 'backup-state.txt') -Raw
if($backupState -notmatch '(?m)^backupComplete=true\r?$'){throw 'Backup completion marker is missing.'}
$backupHash=Get-Sha256 $backupManifest
if($report.backupManifestSha256 -ine $backupHash){throw 'Restore report is for a different backup.'}
$manifestPath=Join-Path $packagePath 'SHA256SUMS'
$releaseTest=Get-Content -LiteralPath (Join-Path $packagePath 'release-test.json') -Raw | ConvertFrom-Json
$imageId=(Get-Content -LiteralPath (Join-Path $packagePath 'image-id.txt') -Raw).Trim()
if($releaseTest.passed -ne $true -or $releaseTest.productionTouched -ne $false -or $releaseTest.image -ne 'edms-ups:2.1.9' -or $releaseTest.imageId -ne $imageId -or $releaseTest.zohoMigrationIsolated -ne $true){throw 'Release verification does not match the update image.'}
$gate=[ordered]@{passed=$true;productionTouched=$false;restoreVerified=$true;testRun=$report.testRun;image='edms-ups:2.1.9';imageId=$imageId;backupManifestSha256=$backupHash;packageManifestSha256=(Get-Sha256 $manifestPath);createdAt=(Get-Date).ToString('o')}
[IO.File]::WriteAllText(
  (Join-Path $packagePath 'update-restore-gate.json'),
  (($gate | ConvertTo-Json -Depth 4) + "`n"),
  [Text.UTF8Encoding]::new($false)
)
Write-Output "BACKUP_RESTORE_GATE_READY $($gate.testRun)"
Write-Output 'Copy the verified package with update-restore-gate.json to the NAS; the app update script validates both manifest hashes before recreating the service.'
