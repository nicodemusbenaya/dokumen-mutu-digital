function Wait-RestoreTestDatabase {
 param(
  [Parameter(Mandatory=$true)][string]$Name,
  [Parameter(Mandatory=$true)][string]$RunId,
  [ValidateRange(1,180)][int]$Attempts=90
 )
 if($RunId -notmatch '^DUMMY-RESTORE-[a-f0-9]{12}$' -or $Name -cne ('edms-restore-db-'+$RunId.ToLowerInvariant())){
  throw 'Readiness check requires the isolated restore-test container identity'
 }
 for($attempt=0;$attempt -lt $Attempts;$attempt++){
  $state=& docker inspect --format '{{.State.Status}}' $Name
  if($LASTEXITCODE -ne 0 -or "$state".Trim() -notin @('running','created')){
   throw 'Isolated restore database exited before authenticated readiness'
  }
  try{
   # TCP excludes the entrypoint temporary socket-only initialization server.
   # ping alone returns success even on Access denied; a real SQL query must pass.
   $answer=& docker exec --env MYSQL_PWD $Name mariadb --protocol=TCP --host=127.0.0.1 --port=3306 `
    --user=root --database=edms_ups --batch --skip-column-names --connect-timeout=2 --execute 'SELECT 1' 2>$null
   if($LASTEXITCODE -eq 0 -and "$answer".Trim() -eq '1'){return $true}
  }catch{}
  if($attempt+1 -lt $Attempts){Start-Sleep -Seconds 1}
 }
 throw 'Isolated restore database did not accept an authenticated TCP query'
}
