param([Parameter(Mandatory=$true)][string]$Backup,[switch]$RehearseEmptyRegister,[switch]$RehearseRoles,[switch]$RehearseUpdate,[string]$UpdatePackage,[string]$UpdateImage='edms-ups:2.1.3',[string]$RestoreImage='edms-ups:2.1.0',[string]$ReuseVerifiedRestoreReport,[string]$StorageSource)
$ErrorActionPreference='Stop'
$restoreImage=if($RehearseUpdate){$UpdateImage}else{$RestoreImage}
. (Join-Path $PSScriptRoot 'restore-test-db.ps1')
$appRoot=Split-Path $PSScriptRoot -Parent
$run='DUMMY-RESTORE-'+[Guid]::NewGuid().ToString('N').Substring(0,12)
$suffix=$run.ToLowerInvariant()
$db='edms-restore-db-'+$suffix
$network='edms-restore-net-'+$suffix
$volume='edms-restore-files-'+$suffix
$helper='edms-restore-check-'+$suffix
$local=Join-Path $appRoot ('release/restore-verification/'+$run)
$copy=Join-Path $local 'backup'
$report=[ordered]@{testRun=$run;backupSource=$Backup;productionTouched=$false;passed=$false;startedAt=(Get-Date).ToString('o')}
$reuseRestore=$null
$reuseManifestEntries=@{}
$restoreCache=Join-Path ([IO.Path]::GetTempPath()) ('edms-restore-cache-'+$suffix)
$saved=@{}
$keys=@('MARIADB_ROOT_PASSWORD','MYSQL_PWD','RESTORE_DB_PASSWORD','RESTORE_TEST_RUN')
foreach($key in $keys){$saved[$key]=[Environment]::GetEnvironmentVariable($key,'Process')}
$password=[Guid]::NewGuid().ToString('N')+[Guid]::NewGuid().ToString('N')
$dbCreated=$false
function Check-Exit([string]$Step){if($LASTEXITCODE -ne 0){throw "$Step failed (exit $LASTEXITCODE)"}}
function Get-Sha256([string]$File){
 $stream=[IO.FileStream]::new($File,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read,1048576,[IO.FileOptions]::SequentialScan);$sha=[Security.Cryptography.SHA256]::Create()
 try{return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','')}finally{$stream.Dispose();$sha.Dispose()}
}
function Remove-TestContainer([string]$Name){
 $existing=& docker ps -a --filter "name=^/$Name`$" --format '{{.Names}}'
 if($LASTEXITCODE -ne 0){throw 'Cannot inspect restore-test container inventory'}
 if("$existing".Trim() -ne $Name){return}
 $labels=& docker inspect --format '{{json .Config.Labels}}' $Name 2>$null
 if($LASTEXITCODE -eq 0 -and ($labels|ConvertFrom-Json).'edms.restoreRun' -eq $run){& docker rm --force --volumes $Name|Out-Null;Check-Exit 'Cleanup restore-test container'}
}
function Capture-RestoreDatabase {
 if(-not $dbCreated){return}
 try{
  $dockerExe=(Get-Command docker -ErrorAction Stop).Source
  $null=Start-Process -FilePath $dockerExe -ArgumentList @('logs',$db) -WindowStyle Hidden -Wait -PassThru `
   -RedirectStandardOutput (Join-Path $local 'db-container-stdout.log') -RedirectStandardError (Join-Path $local 'db-container-stderr.log')
  $state=& docker inspect --format '{{json .State}}' $db
  if($LASTEXITCODE -eq 0){$state|Set-Content -LiteralPath (Join-Path $local 'db-container-state.json') -Encoding utf8}
 }catch{Write-Warning 'Could not capture restore-test database logs'}
}
New-Item -ItemType Directory -Path $copy -Force|Out-Null
try{
 if($RehearseUpdate){$ops=(Resolve-Path -LiteralPath $UpdatePackage).Path}
 if($ReuseVerifiedRestoreReport){
  if(-not $RehearseUpdate -or -not $StorageSource){throw 'Reusing restore evidence requires an update rehearsal and a storage source'}
  $reuseRestore=Get-Content -LiteralPath $ReuseVerifiedRestoreReport -Raw|ConvertFrom-Json
  if($reuseRestore.testRun -notmatch '^DUMMY-RESTORE-[a-f0-9]{12}$' -or $reuseRestore.testRun -eq $run -or $reuseRestore.productionTouched -ne $false -or -not $reuseRestore.backupChecksums -or -not $reuseRestore.databaseRestoreVerified -or -not $reuseRestore.storageBackupVerified -or -not $reuseRestore.composeRestoreVerified -or -not $reuseRestore.restoreVerified){throw 'Prior report does not prove a complete restore of an earlier backup'}
  $priorManifest=Join-Path ([string]$reuseRestore.backupSource) 'SHA256SUMS'
  if(-not (Test-Path -LiteralPath $priorManifest -PathType Leaf) -or (Get-Sha256 $priorManifest) -ine [string]$reuseRestore.backupManifestSha256){throw 'Prior restore report does not match its original backup manifest'}
  foreach($line in Get-Content -LiteralPath $priorManifest){
   if($line -notmatch '^([a-fA-F0-9]{64})[ \t]+\*?([A-Za-z0-9][A-Za-z0-9._-]*)$'){throw 'Prior backup checksum manifest is unsafe or invalid'}
   if($reuseManifestEntries.ContainsKey($Matches[2])){throw 'Duplicate entry in prior backup checksum manifest'}
   $reuseManifestEntries[$Matches[2]]=$Matches[1]
  }
  foreach($name in @('app.tar.gz','app-files.sha256')){if(-not $reuseManifestEntries.ContainsKey($name)){throw "Prior backup entry missing: $name"}}
  $StorageSource=(Resolve-Path -LiteralPath $StorageSource).Path
  if(-not (Test-Path -LiteralPath $StorageSource -PathType Container)){throw 'Read-only storage source is unavailable'}
  $report.reusedRestoreEvidence=$reuseRestore.testRun
 }
 if((& docker info --format '{{.OSType}}').Trim() -ne 'linux'){throw 'Laptop Linux Docker is required'}
 Check-Exit 'Docker access'
 # No connection to the NAS database is made; only backup files are read.
 if(Test-Path -LiteralPath (Join-Path $Backup 'INCOMPLETE')){throw 'Backup is marked incomplete'}
 $state=Get-Content -LiteralPath (Join-Path $Backup 'backup-state.txt') -Raw
 if($state -notmatch '(?m)^backupComplete=true\r?$'){throw 'Backup completion evidence missing'}
 Copy-Item -LiteralPath (Join-Path $Backup 'SHA256SUMS') -Destination $copy
  $report.backupManifestSha256=Get-Sha256 (Join-Path $copy 'SHA256SUMS')
 $seen=@{}
 foreach($line in Get-Content -LiteralPath (Join-Path $copy 'SHA256SUMS')){
  if($line -notmatch '^([a-fA-F0-9]{64})[ \t]+\*?([A-Za-z0-9][A-Za-z0-9._-]*)$'){throw 'Unsafe or invalid backup checksum manifest'}
  $expected=$Matches[1];$name=$Matches[2]
  if($seen.ContainsKey($name)){throw 'Duplicate backup checksum entry'}
  $seen[$name]=$expected
  if($RehearseUpdate -and $reuseRestore -and $name -in @('app.tar.gz','old-runtime-image.tar')){
   # backupComplete is written only after the NAS backup script runs sha256sum -c.
   # Reuse avoids rereading multi-gigabyte archives; the prior full restore proof is
   # reused only when app.tar.gz and app-files.sha256 match that verified snapshot.
   if($name -eq 'app.tar.gz' -and $reuseManifestEntries[$name] -ine $expected){throw 'Prior full restore proof covers a different application archive'}
   if($name -eq 'app.tar.gz'){$report.priorFullRestoreArchiveMatched=$true}
   $report.nasSealedArchiveChecksums=$true
  }elseif($RehearseUpdate -and $name -in @('app.tar.gz','old-runtime-image.tar')){
   if((Get-Sha256 (Join-Path $Backup $name)) -ne $expected){throw "Backup checksum mismatch: $name"}
  }else{
   Copy-Item -LiteralPath (Join-Path $Backup $name) -Destination $copy
   if((Get-Sha256 (Join-Path $copy $name)) -ne $expected){throw "Backup checksum mismatch: $name"}
  }
 }
 if($reuseRestore -and $reuseManifestEntries['app-files.sha256'] -ine $seen['app-files.sha256']){throw 'Prior full restore proof covers a different application file manifest'}
 foreach($name in @('database.sql','app.tar.gz','app-files.sha256','table-counts.tsv','db-objects.tsv','old-runtime-image.tar','old-container.inspect.json','compose-project.tar','event-policy.txt')){
  if(-not $seen.ContainsKey($name)){throw "Required backup entry missing: $name"}
 }
 $report.backupChecksums=$true
 $env:MARIADB_ROOT_PASSWORD=$password;$env:MYSQL_PWD=$password
 $env:RESTORE_DB_PASSWORD=$password;$env:RESTORE_TEST_RUN=$run
 Write-Output 'RESTORE_STEP: isolated laptop database, with no published port'
 & docker network create --internal --label "edms.restoreRun=$run" $network|Out-Null
 Check-Exit 'Restore network'
 & docker volume create --label "edms.restoreRun=$run" $volume|Out-Null
 Check-Exit 'Restore files volume'
 & docker run --detach --name $db --label "edms.restoreRun=$run" --network $network `
  --mount "type=bind,source=$copy,target=/restore-source,readonly" `
  --env MARIADB_ROOT_PASSWORD --env 'MARIADB_DATABASE=edms_ups' --env 'MARIADB_ROOT_HOST=%' `
  mariadb:10.11 --event-scheduler=OFF|Out-Null
 Check-Exit 'Restore database container'
 $dbCreated=$true;$report.databaseStage='waiting-authenticated-tcp'
 $null=Wait-RestoreTestDatabase -Name $db -RunId $run
 Write-Output 'RESTORE_DB_AUTHENTICATED: TCP login and SELECT 1 succeeded'
 $report.databaseStage='restoring-sql'
 & docker exec --env MYSQL_PWD $db sh -c 'exec mariadb --protocol=TCP --host=127.0.0.1 --port=3306 --user=root --database=edms_ups < /restore-source/database.sql'
 Check-Exit 'Restore database dump'
 $validator=Join-Path $PSScriptRoot 'verify-restored-db.mjs'
 & docker run --rm --name $helper --label "edms.restoreRun=$run" --network $network `
  --mount "type=bind,source=$copy,target=/backup,readonly" `
  --mount "type=bind,source=$validator,target=/opt/edms/scripts/verify-restored-db.mjs,readonly" `
  --env RESTORE_DB_PASSWORD --env RESTORE_TEST_RUN --env "RESTORE_DB_HOST=$db" --env 'RESTORE_SOURCE=/backup' `
  --entrypoint node $restoreImage scripts/verify-restored-db.mjs
 Check-Exit 'Restored table counts, accounts and database objects'
 $report.databaseRestoreVerified=$true
 $report.databaseStage='verified'
  if($reuseRestore){
   Write-Output 'RESTORE_STEP: reuse full restore proof and recheck linked storage files'
   $baseline=Get-Content -LiteralPath (Join-Path $copy 'update-baseline.json') -Raw|ConvertFrom-Json
   New-Item -ItemType Directory -Path (Join-Path $restoreCache 'edms-app\storage') -Force|Out-Null
   foreach($file in $baseline.v2_files){
    $relative=[string]$file.disk_path
    if($relative -notmatch '^(originals|derived)/[a-f0-9-]{36}\.(pdf|docx|xlsx)$'){throw 'Unsafe linked storage path in update baseline'}
    $sourceFile=Join-Path $StorageSource ($relative.Replace('/',[char]92))
    if(-not (Test-Path -LiteralPath $sourceFile -PathType Leaf)){throw "Linked backup file missing from stopped storage: $relative"}
    $sourceItem=Get-Item -LiteralPath $sourceFile
    if(($sourceItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw "Linked backup file is a reparse point: $relative"}
    $targetFile=Join-Path (Join-Path $restoreCache 'edms-app\storage') ($relative.Replace('/',[char]92))
    New-Item -ItemType Directory -Path (Split-Path -Parent $targetFile) -Force|Out-Null
    Copy-Item -LiteralPath $sourceFile -Destination $targetFile
    if((Get-FileHash -LiteralPath $targetFile -Algorithm SHA256).Hash.ToLowerInvariant() -ne ([string]$file.sha256).ToLowerInvariant() -or (Get-Item -LiteralPath $targetFile).Length.ToString() -ne [string]$file.size){throw "Linked backup file differs from the recorded snapshot: $relative"}
   }
   & docker run --rm --name $helper --label "edms.restoreRun=$run" --network none --user 0 --read-only `
    --mount "type=volume,source=$volume,target=/restore" --mount "type=bind,source=$restoreCache,target=/restore-cache,readonly" `
    --entrypoint sh $restoreImage -c 'set -eu; cp -a /restore-cache/. /restore/; echo VERIFIED_LINKED_STORAGE_COPY_PASS'
   Check-Exit 'Copy hash-verified linked files into isolated restore volume'
   & docker run --rm --name $helper --label "edms.restoreRun=$run" --network none --user 0 --read-only `
    --mount "type=bind,source=$copy,target=/backup,readonly" --mount "type=volume,source=$volume,target=/restore" `
    --entrypoint sh $restoreImage -c 'set -eu; mkdir -p /restore/compose; tar -xf /backup/compose-project.tar -C /restore/compose; test -f /restore/compose/docker-compose.yml; test -f /restore/compose/docker-compose.resource.yml; echo RESTORED_COMPOSE_PASS'
   Check-Exit 'Restore Compose project from backup'
   Remove-Item -LiteralPath $restoreCache -Recurse -Force
   $report.restoreMethod='Reused prior full restore proof; linked storage files rehashed from stopped NAS storage'
   $report.linkedStorageFilesRechecked=$baseline.v2_files.Count
  }elseif($RehearseUpdate){
   Write-Output 'RESTORE_STEP: extract old app/storage and verify every original file hash'
  & python (Join-Path $ops 'scripts/restore-storage-stream.py') (Join-Path $Backup 'app.tar.gz') (Join-Path $copy 'app-files.sha256') $run
  Check-Exit 'Stream archive: verify every archived file hash and restore storage'
  & docker run --rm --name $helper --label "edms.restoreRun=$run" --network none --user 0 --read-only `
   --mount "type=bind,source=$copy,target=/backup,readonly" --mount "type=volume,source=$volume,target=/restore" `
   --entrypoint sh $restoreImage -c 'set -eu; mkdir /restore/compose; tar -xf /backup/compose-project.tar -C /restore/compose; test -f /restore/compose/docker-compose.yml; test -f /restore/compose/docker-compose.resource.yml; echo RESTORED_STORAGE_AND_COMPOSE_PASS'
  Check-Exit 'Restored storage and Compose'
  $report.restoreMethod='Stream verified complete archive; storage restored; large backup blobs retained on NAS'
  }else{
  Write-Output 'RESTORE_STEP: extract old app/storage and verify every original file hash'
 & docker run --rm --name $helper --label "edms.restoreRun=$run" --network none --user 0 --read-only `
  --mount "type=bind,source=$copy,target=/backup,readonly" --mount "type=volume,source=$volume,target=/restore" `
   --entrypoint sh $restoreImage -c 'set -eu; tar -xzf /backup/app.tar.gz -C /restore; cd /restore; sha256sum --quiet -c /backup/app-files.sha256; mkdir /restore/compose; tar -xf /backup/compose-project.tar -C /restore/compose; test -f /restore/compose/docker-compose.yml; test -f /restore/compose/docker-compose.resource.yml; echo RESTORED_FILES_AND_COMPOSE_PASS'
 Check-Exit 'Restored app/storage file hashes and Compose files'
 }
 $report.storageBackupVerified=$true;$report.composeRestoreVerified=$true
 $report.restoreVerified=$true
 if($RehearseEmptyRegister){
  Write-Output 'RESTORE_STEP: rehearse empty v2 register on the isolated restored database'
  $rehearsal=Join-Path $PSScriptRoot 'rehearse-empty-register.mjs'
  $transitionCore=Join-Path $PSScriptRoot 'empty-register-core.mjs'
  & docker run --rm --name $helper --label "edms.restoreRun=$run" --network $network --user 0 --read-only `
   --mount "type=bind,source=$copy,target=/backup,readonly" `
   --mount "type=bind,source=$local,target=/evidence" `
   --mount "type=bind,source=$rehearsal,target=/opt/edms/scripts/rehearse-empty-register.mjs,readonly" `
   --mount "type=bind,source=$transitionCore,target=/opt/edms/scripts/empty-register-core.mjs,readonly" `
   --env RESTORE_DB_PASSWORD --env RESTORE_TEST_RUN --env "RESTORE_DB_HOST=$db" `
   --entrypoint node edms-ups:2.1.0 scripts/rehearse-empty-register.mjs
  Check-Exit 'Empty register transition rehearsal'
  $receipt=Get-Content -LiteralPath (Join-Path $local 'empty-register-result.json') -Raw|ConvertFrom-Json
  if(-not $receipt.passed -or $receipt.productionTouched -or $receipt.backupManifestSha256 -ne $report.backupManifestSha256.ToLowerInvariant()){throw 'Rehearsal receipt does not match restored backup'}
  $report.emptyRegisterRehearsalVerified=$true
  $report.emptyRegisterManifestSha256=$receipt.manifestSha256
 }
 if($RehearseRoles){
  if($RehearseEmptyRegister){throw 'Role update rehearsal must not empty the restored document register'}
  $roleScripts=$PSScriptRoot
  foreach($phase in @('migrate','rollback')){
   if($phase -eq 'rollback'){
    & docker exec --env MYSQL_PWD $db sh -c 'exec mariadb --protocol=TCP --host=127.0.0.1 --user=root --database=edms_ups < /restore-source/database.sql'
    Check-Exit 'Rehearse role migration DB rollback'
   }
   $roleArgs=@('run','--rm','--name',$helper,'--label',"edms.restoreRun=$run",'--network',$network,'--user','0','--read-only',
    '--mount',"type=bind,source=$roleScripts,target=/opt/edms/scripts,readonly",'--mount',"type=bind,source=$local,target=/evidence",
    '--env','RESTORE_DB_PASSWORD','--env','RESTORE_TEST_RUN','--env',"RESTORE_DB_HOST=$db",'--entrypoint','node','edms-ups:2.1.1','scripts/role-rehearsal.mjs')
   if($phase -eq 'rollback'){$roleArgs+='--verify-rollback'}
   & docker @roleArgs
   Check-Exit "Role rehearsal $phase"
  }
  $roleReceipt=Get-Content -LiteralPath (Join-Path $local 'role-rehearsal-result.json') -Raw|ConvertFrom-Json
  if(-not $roleReceipt.passed -or -not $roleReceipt.rollbackVerified -or $roleReceipt.productionTouched){throw 'Role migration/rollback rehearsal not verified'}
  $report.roleMigrationVerified=$true
 }
 if($RehearseUpdate){
  if($RehearseEmptyRegister -or $RehearseRoles){throw 'RehearseUpdate already tests the role and upload update; never combine with register cleanup'}
  if(-not (Test-Path -LiteralPath (Join-Path $copy 'update-baseline.json'))){throw 'Current update backup baseline missing'}
  $ops=(Resolve-Path -LiteralPath $UpdatePackage).Path
  $packageSha=Get-Sha256 (Join-Path $ops 'SHA256SUMS')
  Copy-Item -LiteralPath (Join-Path $copy 'update-baseline.json') -Destination $local
  foreach($phase in @('rehearse','rollback-verify')){
   if($phase -eq 'rollback-verify'){
    Remove-TestContainer $db
    $dbCreated=$false
    & docker run --detach --name $db --label "edms.restoreRun=$run" --network $network `
     --mount "type=bind,source=$copy,target=/restore-source,readonly" `
     --env MARIADB_ROOT_PASSWORD --env 'MARIADB_DATABASE=edms_ups' --env 'MARIADB_ROOT_HOST=%' `
     mariadb:10.11 --event-scheduler=OFF|Out-Null
    Check-Exit 'Start clean rollback restore database'
    $dbCreated=$true;$report.databaseStage='rollback-restoring-sql'
    $null=Wait-RestoreTestDatabase -Name $db -RunId $run
    & docker exec --env MYSQL_PWD $db sh -c 'exec mariadb --protocol=TCP --host=127.0.0.1 --port=3306 --user=root --database=edms_ups < /restore-source/database.sql'
    Check-Exit 'Restore pre-update DB on laptop for rollback verification'
    $validator=Join-Path $PSScriptRoot 'verify-restored-db.mjs'
    & docker run --rm --name $helper --label "edms.restoreRun=$run" --network $network `
     --mount "type=bind,source=$copy,target=/backup,readonly" `
     --mount "type=bind,source=$validator,target=/opt/edms/scripts/verify-restored-db.mjs,readonly" `
     --env RESTORE_DB_PASSWORD --env RESTORE_TEST_RUN --env "RESTORE_DB_HOST=$db" --env 'RESTORE_SOURCE=/backup' `
     --entrypoint node $restoreImage scripts/verify-restored-db.mjs
    Check-Exit 'Verify clean rollback database restore'
   }
   & docker run --rm --name $helper --label "edms.restoreRun=$run" --network $network --user 0 --read-only `
    --mount "type=bind,source=$ops,target=/ops,readonly" `
    --mount "type=bind,source=$ops/scripts,target=/opt/edms/scripts,readonly" `
    --mount "type=bind,source=$ops/src/lib,target=/opt/edms/src/lib,readonly" `
    --mount "type=bind,source=$local,target=/evidence" `
    --mount "type=volume,source=$volume,target=/restored,readonly" `
    --env EDMS_UPDATE=guarded --env RESTORE_DB_PASSWORD --env RESTORE_TEST_RUN --env "RESTORE_DB_HOST=$db" `
    --entrypoint node $UpdateImage scripts/update-db.mjs $phase
   Check-Exit "Update rehearsal $phase"
  }
  $updateReceipt=Get-Content -LiteralPath (Join-Path $local 'update-rehearsal.json') -Raw|ConvertFrom-Json
  if(-not $updateReceipt.passed -or -not $updateReceipt.rollbackVerified -or -not $updateReceipt.idempotencyVerified -or $updateReceipt.productionTouched -or $updateReceipt.restoredFilesHashVerified -ne $updateReceipt.retained.files){throw 'Update migration/rollback/file restore rehearsal not verified'}
  $report.updateMigrationVerified=$true
  $receipt=[ordered]@{passed=$true;productionTouched=$false;rollbackVerified=$true;idempotencyVerified=$true;databaseRestoreVerified=$true;storageRestoreVerified=$true;restoredFilesHashVerified=$updateReceipt.restoredFilesHashVerified;backupManifestSha256=$report.backupManifestSha256.ToLowerInvariant();updatePackageSha256=$packageSha.ToLowerInvariant();baselineSha256=(Get-Sha256 (Join-Path $copy 'update-baseline.json')).ToLowerInvariant();image=$UpdateImage;retained=$updateReceipt.retained;testRun=$run}
  $receipt|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $ops 'update-rehearsal-pass.json') -Encoding utf8
 }
 $report.passed=$true
}catch{
 $report.error=$_.Exception.Message
 Write-Warning $report.error
}finally{
 Capture-RestoreDatabase
 foreach($name in @($helper,$db)){try{Remove-TestContainer $name}catch{Write-Warning "Inspect test container: $name"}}
 try{$labels=& docker volume inspect --format '{{json .Labels}}' $volume 2>$null;if($LASTEXITCODE -eq 0 -and ($labels|ConvertFrom-Json).'edms.restoreRun' -eq $run){& docker volume rm $volume|Out-Null}}catch{}
 try{$labels=& docker network inspect --format '{{json .Labels}}' $network 2>$null;if($LASTEXITCODE -eq 0 -and ($labels|ConvertFrom-Json).'edms.restoreRun' -eq $run){& docker network rm $network|Out-Null}}catch{}
 if(Test-Path -LiteralPath $restoreCache -PathType Container){try{Remove-Item -LiteralPath $restoreCache -Recurse -Force}catch{Write-Warning 'Could not remove the temporary linked-file copy'}}
 foreach($key in $keys){[Environment]::SetEnvironmentVariable($key,$saved[$key],'Process')}
 $report.finishedAt=(Get-Date).ToString('o')
 $report|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $local 'result.json') -Encoding utf8
}
if(-not $report.passed){throw "RESTORE_NOT_VERIFIED: $local"}
Write-Output "NAS_BACKUP_RESTORE_PASS: $local"
Write-Output 'Only laptop test containers were used. NAS maintenance state has not been changed.'
