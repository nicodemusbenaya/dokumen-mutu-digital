param([Parameter(Mandatory=$true)][string]$Package)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'restore-test-db.ps1')
$appRoot=Split-Path $PSScriptRoot -Parent
$ops=(Resolve-Path -LiteralPath $Package).Path
$releaseRoot=[IO.Path]::GetFullPath((Join-Path $appRoot 'release'))+[IO.Path]::DirectorySeparatorChar
if(-not $ops.StartsWith($releaseRoot,[StringComparison]::OrdinalIgnoreCase) -or (Split-Path $ops -Leaf) -notmatch '^nas-cutover-[a-f0-9]{8}$'){throw 'Use a prepared local release/nas-cutover package'}
$transition=Join-Path $appRoot 'release/nas-transition-453aaecb'
$source=Join-Path $appRoot 'release/restore-verification/DUMMY-RESTORE-d1d626a66e24'
$backup=Join-Path $source 'backup'
$run='DUMMY-RESTORE-'+[Guid]::NewGuid().ToString('N').Substring(0,12)
$suffix=$run.ToLowerInvariant()
$db='edms-restore-db-'+$suffix;$network='edms-restore-net-'+$suffix
$app='edms-cutover-app-'+$suffix;$helper='edms-cutover-check-'+$suffix;$volume='edms-cutover-files-'+$suffix
$local=Join-Path $appRoot ('release/cutover-verification/'+$run)
$report=[ordered]@{testRun=$run;productionTouched=$false;passed=$false;runtime=$false;smoke=$false;restart=$false;rollback=$false;startedAt=(Get-Date).ToString('o')}
$keys=@('MARIADB_ROOT_PASSWORD','MYSQL_PWD','RESTORE_DB_PASSWORD','RESTORE_TEST_RUN','RESTORE_DB_HOST')
$saved=@{};foreach($k in $keys){$saved[$k]=[Environment]::GetEnvironmentVariable($k,'Process')}
function Check-Exit([string]$Step){if($LASTEXITCODE -ne 0){throw "$Step failed (exit $LASTEXITCODE)"}}
function Get-Sha([string]$File){$stream=[IO.File]::OpenRead($File);$sha=[Security.Cryptography.SHA256]::Create();try{return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}finally{$stream.Dispose();$sha.Dispose()}}
function Remove-OwnedContainer([string]$Name){
 $found=& docker ps -a --filter "name=^/$Name`$" --format '{{.Names}}';Check-Exit 'Inspect test container'
 if("$found".Trim() -ne $Name){return}
 $label=& docker inspect --format '{{index .Config.Labels "edms.restoreRun"}}' $Name;Check-Exit 'Inspect test ownership'
 if("$label".Trim() -ne $run){throw 'Test container ownership mismatch'}
 & docker rm --force --volumes $Name|Out-Null;Check-Exit 'Remove owned test container'
}
function Render-Compose([string]$InputFile,[string]$OutputFile){
 $dockerExe=(Get-Command docker -ErrorAction Stop).Source
 $process=Start-Process -FilePath $dockerExe -WindowStyle Hidden -Wait -PassThru `
  -ArgumentList @('compose','-p',$suffix,'-f',('"'+$InputFile+'"'),'config','--format','json') `
  -RedirectStandardOutput $OutputFile -RedirectStandardError (Join-Path $local 'compose-stderr.log')
 if($process.ExitCode -ne 0){throw 'Compose rendering failed; inspect the private compose-stderr.log'}
}
function Invoke-Ops([string]$Mode,[string]$Expected='staging-normalized.json'){
 & docker run --rm --name $helper --label "edms.restoreRun=$run" --network $network --user 0 --read-only `
  --mount "type=bind,source=$ops/scripts,target=/opt/edms/scripts,readonly" `
  --mount "type=bind,source=$ops/tests,target=/opt/edms/tests,readonly" `
  --mount "type=bind,source=$transition,target=/transition,readonly" `
  --mount "type=bind,source=$backup,target=/backup,readonly" `
  --mount "type=bind,source=$local,target=/evidence" `
  --mount "type=bind,source=$local/merged.json,target=/merged-compose.json,readonly" `
  --mount "type=bind,source=$local/original.json,target=/original-compose.json,readonly" `
  --mount "type=volume,source=$volume,target=/app/storage" `
  --env EDMS_CUTOVER=guarded --env RESTORE_TEST_RUN --env RESTORE_DB_HOST --env RESTORE_DB_PASSWORD `
  --env 'ROLLBACK_IMAGE=edms-ups-rollback:cutover-dummy' --env "CUTOVER_BASE_URL=http://${app}:3000" `
  --env "COMPOSE_EXPECTED=$Expected" `
  --entrypoint node edms-ups:2.1.0 scripts/nas-cutover.mjs $Mode
 Check-Exit "Cutover rehearsal $Mode"
}
New-Item -ItemType Directory -Path $local -Force|Out-Null
$receiptPath=Join-Path $ops 'rehearsal-pass.json'
if(Test-Path -LiteralPath $receiptPath){Move-Item -LiteralPath $receiptPath -Destination (Join-Path $ops ('previous-rehearsal-'+$run+'.json'))}
$inProgress=Join-Path $ops 'REHEARSAL_IN_PROGRESS'
Set-Content -LiteralPath $inProgress -Value $run -Encoding ascii
try{
 $prior=Get-Content -LiteralPath (Join-Path $source 'result.json') -Raw|ConvertFrom-Json
 if(-not $prior.passed -or -not $prior.emptyRegisterRehearsalVerified -or $prior.productionTouched){throw 'Passed source backup/rehearsal missing'}
 foreach($manifest in @((Join-Path $backup 'SHA256SUMS'),(Join-Path $ops 'SHA256SUMS'))){
  $parent=Split-Path $manifest -Parent
  foreach($line in Get-Content -LiteralPath $manifest){
   if($line -notmatch '^([a-fA-F0-9]{64})  ([A-Za-z0-9][A-Za-z0-9._/-]*)$' -or ($Matches[2] -split '/') -contains '..'){throw 'Invalid checksum manifest'}
   if((Get-Sha (Join-Path $parent $Matches[2])) -ne $Matches[1].ToLowerInvariant()){throw 'Input checksum differs'}
  }
 }
 if((Get-Sha (Join-Path $backup 'SHA256SUMS')) -ne $prior.backupManifestSha256.ToLowerInvariant()){throw 'Backup manifest changed'}
 $report.cutoverPackageSha256=Get-Sha (Join-Path $ops 'SHA256SUMS')
 $report.transitionManifestSha256=$prior.emptyRegisterManifestSha256
 if((& docker info --format '{{.OSType}}').Trim() -ne 'linux'){throw 'Laptop Linux Docker required'}
 Check-Exit 'Docker access'
 & docker run --rm --network none --read-only --mount "type=bind,source=$ops,target=/ops,readonly" --entrypoint sh edms-ups:2.1.0 -n /ops/nas-cutover.sh
 Check-Exit 'Linux cutover shell syntax'
 $password=[Guid]::NewGuid().ToString('N')+[Guid]::NewGuid().ToString('N')
 $env:MARIADB_ROOT_PASSWORD=$password;$env:MYSQL_PWD=$password;$env:RESTORE_DB_PASSWORD=$password;$env:RESTORE_TEST_RUN=$run;$env:RESTORE_DB_HOST=$db
 Write-Output 'CUTOVER_TEST_STEP: restore verified backup into isolated laptop DB; no published ports'
 & docker network create --internal --label "edms.restoreRun=$run" $network|Out-Null;Check-Exit 'Create test network'
 & docker volume create --label "edms.restoreRun=$run" $volume|Out-Null;Check-Exit 'Create test volume'
 & docker run --detach --name $db --label "edms.restoreRun=$run" --network $network `
  --mount "type=bind,source=$backup,target=/restore-source,readonly" --env MARIADB_ROOT_PASSWORD `
  --env 'MARIADB_DATABASE=edms_ups' --env 'MARIADB_ROOT_HOST=%' mariadb:10.11 --event-scheduler=OFF|Out-Null
 Check-Exit 'Start test DB';$null=Wait-RestoreTestDatabase -Name $db -RunId $run
 & docker exec --env MYSQL_PWD $db sh -c 'exec mariadb --protocol=TCP --host=127.0.0.1 --user=root --database=edms_ups < /restore-source/database.sql'
 Check-Exit 'Restore baseline SQL'
 $old=(Get-Content -LiteralPath (Join-Path $backup 'old-container.inspect.json') -Raw|ConvertFrom-Json)[0]
 $runtimeEnv=@{};foreach($line in $old.Config.Env){$kv=$line -split '=',2;if($kv[0] -match '^(DB_|JWT_SECRET|SESSION_COOKIE|NEXT_PUBLIC_APP_URL|APP_ORIGIN)'){$runtimeEnv[$kv[0]]=$kv[1]}}
 # Compose interpolation must preserve literal dollar signs in existing secrets.
 $seedEnv=@{};foreach($k in $runtimeEnv.Keys){$seedEnv[$k]=([string]$runtimeEnv[$k]).Replace('$','$$')}
 $service=@{container_name='edms-ups-app';image='edms-ups:2.1.0';working_dir='/opt/edms';command=@('node','scripts/start.mjs');environment=$seedEnv;ports=@(@{mode='ingress';target=3000;published='3000';protocol='tcp'});volumes=@(@{type='bind';source='/share/Container/edms-app';target='/app'},@{type='bind';source='/share/Container/edms-app/storage';target='/app/storage'})}
 $seed=Join-Path $local 'fixture-compose.json'
 @{services=@{'edms-app'=$service}}|ConvertTo-Json -Depth 15|Set-Content -LiteralPath $seed -Encoding utf8
 Render-Compose $seed (Join-Path $local 'merged.json')
 Copy-Item -LiteralPath (Join-Path $local 'merged.json') -Destination (Join-Path $local 'original.json')
 Invoke-Ops 'prepare'
 foreach($kind in @('staging','runtime')){
  Render-Compose (Join-Path $local ($kind+'-compose.json')) (Join-Path $local 'rendered.json')
  Copy-Item -LiteralPath (Join-Path $local 'rendered.json') -Destination (Join-Path $local 'merged.json') -Force
  Invoke-Ops 'compose-check' ($kind+'-normalized.json')
 }
 Invoke-Ops 'apply'
 & docker run --rm --network none --user 0 --mount "type=volume,source=$volume,target=/app/storage" --entrypoint node edms-ups:2.1.0 -e 'require("fs").chownSync("/app/storage",1000,1000)'
 Check-Exit 'Initialize owned dummy storage'
 Write-Output 'CUTOVER_TEST_STEP: start release with the new restricted DB account'
 & docker run --detach --name $app --label "edms.restoreRun=$run" --network $network `
  --mount "type=volume,source=$volume,target=/app/storage" --env-file (Join-Path $local 'runtime.env') edms-ups:2.1.0|Out-Null
 Check-Exit 'Start isolated release';Invoke-Ops 'health'
 & docker exec $app node scripts/preflight.mjs;Check-Exit 'Linux runtime preflight';$report.runtime=$true
 Invoke-Ops 'smoke';$report.smoke=$true
 Invoke-Ops 'verify'
 Write-Output 'CUTOVER_TEST_STEP: restart release and verify health'
 & docker restart $app|Out-Null;Check-Exit 'Restart release';Invoke-Ops 'health';$report.restart=$true
 Write-Output 'CUTOVER_TEST_STEP: restore baseline after cutover and compare the entire DB snapshot'
 & docker stop $app|Out-Null;Check-Exit 'Stop test writer'
 & docker exec --env MYSQL_PWD $db sh -c 'exec mariadb --protocol=TCP --host=127.0.0.1 --user=root --database=edms_ups < /restore-source/database.sql'
 Check-Exit 'Rehearse rollback SQL';Invoke-Ops 'rollback-verify';$report.rollback=$true
 $report.passed=$true
 $report|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $receiptPath -Encoding utf8
}catch{ $report.error=$_.Exception.Message;Write-Warning $report.error }
finally{
 foreach($name in @($app,$db)){
  try{& docker logs --tail 150 $name 1>(Join-Path $local ($name+'-stdout.log')) 2>(Join-Path $local ($name+'-stderr.log'))}catch{}
 }
 foreach($name in @($helper,$app,$db)){try{Remove-OwnedContainer $name}catch{Write-Warning "Inspect test container: $name"}}
 try{$label=& docker volume inspect --format '{{index .Labels "edms.restoreRun"}}' $volume 2>$null;if($LASTEXITCODE -eq 0 -and "$label".Trim() -eq $run){& docker volume rm $volume|Out-Null}}catch{}
 try{$label=& docker network inspect --format '{{index .Labels "edms.restoreRun"}}' $network 2>$null;if($LASTEXITCODE -eq 0 -and "$label".Trim() -eq $run){& docker network rm $network|Out-Null}}catch{}
 foreach($k in $keys){[Environment]::SetEnvironmentVariable($k,$saved[$k],'Process')}
 $report.finishedAt=(Get-Date).ToString('o');$report|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $local 'result.json') -Encoding utf8
 Remove-Item -LiteralPath $inProgress -Force
}
if(-not $report.passed){throw "CUTOVER_REHEARSAL_FAILED: $local"}
Write-Output "NAS_CUTOVER_REHEARSAL_PASS: $local"
Write-Output 'Only isolated laptop containers were used. NAS and original local documents were not modified.'
