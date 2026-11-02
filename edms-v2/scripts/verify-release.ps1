param([string]$Tag = 'edms-ups:2.1.3', [switch]$SkipBrowser)
$ErrorActionPreference = 'Stop'
$appRoot = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'run-node-logged.ps1')
$runId = 'DUMMY-' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
$testNetwork = 'edms-testnet-' + $runId.ToLowerInvariant()
$testDb = 'edms-testdb-' + $runId.ToLowerInvariant()
$testApp = 'edms-testapp-' + $runId.ToLowerInvariant()
$password = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
$testSecret = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
$envKeys = @('DB_HOST','DB_PORT','DB_NAME','DB_USER','DB_PASSWORD','JWT_SECRET',
  'RUN_DUMMY_DB_TESTS','DUMMY_TEST_RUN','TEST_BASE_URL','STORAGE_ROOT','MARIADB_ROOT_PASSWORD')
$savedEnv = @{}
foreach ($key in $envKeys) { $savedEnv[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }
$report = [ordered]@{ testRun=$runId; image=$Tag; productionTouched=$false; startedAt=(Get-Date).ToString('o'); passed=$false }
$reportDir = Join-Path $appRoot ('release/verification/' + $runId)
New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
$dockerExe = (Get-Command docker -ErrorAction Stop).Source

function Capture-TestContainer([string]$Name, [string]$Prefix) {
  # Capture stdout/stderr separately: Windows PowerShell 5.1 may turn native
  # stderr into a terminating NativeCommandError when it is merged into a pipe.
  try {
    $process = Start-Process -FilePath $dockerExe -ArgumentList @('logs', $Name) `
      -WindowStyle Hidden -Wait -PassThru `
      -RedirectStandardOutput (Join-Path $reportDir ($Prefix + '-stdout.log')) `
      -RedirectStandardError (Join-Path $reportDir ($Prefix + '-stderr.log'))
    $stateJson = & docker inspect --format '{{json .State}}' $Name 2>$null
    if ($LASTEXITCODE -eq 0) {
      $stateJson | Set-Content -LiteralPath (Join-Path $reportDir ($Prefix + '-state.json')) -Encoding utf8
    }
  } catch {
    $_.Exception.Message | Set-Content -LiteralPath (Join-Path $reportDir ($Prefix + '-diagnostic-error.txt')) -Encoding utf8
  }
}

function Check-Exit([string]$Step) {
  if ($LASTEXITCODE -ne 0) { throw "$Step gagal (exit $LASTEXITCODE). Lihat log verifikasi." }
}
function Free-Port {
  $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
  $listener.Start()
  try { return $listener.LocalEndpoint.Port } finally { $listener.Stop() }
}
function Stop-TestContainer([string]$Name) {
  $labelJson = & docker inspect --format '{{json .Config.Labels}}' $Name 2>$null
  if ($LASTEXITCODE -eq 0 -and ($labelJson | ConvertFrom-Json).'edms.testRun' -eq $runId) {
    & docker rm --force --volumes $Name | Out-Null
    Check-Exit ('Cleanup container dummy ' + $Name)
  }
}

Push-Location $appRoot
try {
  & docker info --format '{{.OSType}}' | Out-Null
  Check-Exit 'Akses Docker Linux'
  $platform = & docker image inspect $Tag --format '{{.Os}}/{{.Architecture}}'
  Check-Exit 'Pemeriksaan image'
  if ("$platform".Trim() -ne 'linux/amd64') { throw 'Image harus linux/amd64.' }
  $report.imageId = (& docker image inspect $Tag --format '{{.Id}}').Trim()

  Write-Output '[1/6] Membuat fixture dummy dan menjalankan test inti'
  Invoke-LoggedNode -Step 'Test inti' -NodeArguments @('--test','tests/core.test.mjs','tests/import-summary.test.mjs','tests/management.test.mjs','tests/resource.test.mjs','tests/permanent-delete.test.mjs','tests/masters.test.mjs','tests/master-select.test.mjs','tests/filename-identity.test.mjs','tests/import-classification.test.mjs','tests/import-folders.test.mjs','tests/document-map.test.mjs','tests/role-policy.test.mjs','tests/update-retention.test.mjs') `
    -WorkingDirectory $appRoot -LogDirectory $reportDir -LogName 'core-tests'
  $report.coreTests = $true

  $dbPort = Free-Port
  $appPort = Free-Port
  while ($appPort -eq $dbPort) { $appPort = Free-Port }
  $base = 'http://127.0.0.1:' + $appPort
  $env:MARIADB_ROOT_PASSWORD = $password
  $env:DB_HOST = '127.0.0.1'
  $env:DB_PORT = [string]$dbPort
  $env:DB_NAME = 'edms_dummy'
  $env:DB_USER = 'root'
  $env:DB_PASSWORD = $password
  $env:JWT_SECRET = $testSecret
  $env:DUMMY_TEST_RUN = $runId
  $env:RUN_DUMMY_DB_TESTS = 'true'
  $env:TEST_BASE_URL = $base
  $env:STORAGE_ROOT = Join-Path $reportDir 'unused-host-storage'

  Write-Output '[2/6] Menjalankan MariaDB test sementara pada laptop'
  & docker network create --label "edms.testRun=$runId" $testNetwork | Out-Null
  Check-Exit 'Network test'
  & docker run --detach --name $testDb --label "edms.testRun=$runId" --network $testNetwork `
    --publish "127.0.0.1:${dbPort}:3306" --env MARIADB_ROOT_PASSWORD `
    --env 'MARIADB_DATABASE=edms_dummy' --env 'MARIADB_ROOT_HOST=%' mariadb:10.11 | Out-Null
  Check-Exit 'MariaDB test'
  Invoke-LoggedNode -Step 'Schema akun dummy' -NodeArguments @('scripts/seed-test-db.mjs') `
    -WorkingDirectory $appRoot -LogDirectory $reportDir -LogName 'seed'
  Invoke-LoggedNode -Step 'Schema v2 pada database dummy' -NodeArguments @('scripts/migrate.mjs') `
    -WorkingDirectory $appRoot -LogDirectory $reportDir -LogName 'migrate'

  Write-Output '[3/6] Menjalankan image rilis dan worker di laptop'
  & docker run --detach --name $testApp --label "edms.testRun=$runId" --network $testNetwork `
    --publish "127.0.0.1:${appPort}:3000" `
    --tmpfs '/app/storage:rw,uid=1000,gid=1000,mode=0700,size=768m' `
    --env "DB_HOST=$testDb" --env 'DB_PORT=3306' --env 'DB_NAME=edms_dummy' `
    --env 'DB_USER=root' --env DB_PASSWORD --env JWT_SECRET `
    --env "APP_ORIGIN=$base" --env "NEXT_PUBLIC_APP_URL=$base" `
    --env 'COOKIE_SECURE=false' --env 'HOSTNAME=0.0.0.0' $Tag | Out-Null
  Check-Exit 'Image aplikasi'
  $report.testBaseUrl = $base
  $ready = $false
  $lastHealthError = ''
  for ($attempt=0; $attempt -lt 60; $attempt++) {
    $state = & docker inspect --format '{{.State.Status}}' $testApp 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'Container aplikasi test tidak dapat diperiksa.' }
    if ("$state".Trim() -ne 'running') {
      Capture-TestContainer $testApp 'app-container'
      throw "Container aplikasi berhenti saat startup (status: $state). Lihat app-container-stderr.log."
    }
    try {
      $health = Invoke-RestMethod -Uri ($base + '/api/v2/health') -TimeoutSec 3
      if ($health.ok) { $ready=$true; break }
    } catch { $lastHealthError=$_.Exception.Message; Start-Sleep -Seconds 1 }
  }
  if (-not $ready) {
    Capture-TestContainer $testApp 'app-container'
    $report.lastHealthError = $lastHealthError
    throw 'Aplikasi test tidak ready dalam 60 percobaan. Log startup dan state sudah disimpan.'
  }
  & docker exec $testApp node scripts/preflight.mjs 2>&1 | Tee-Object -FilePath (Join-Path $reportDir 'linux-preflight.log')
  Check-Exit 'Preflight image Linux'
  $report.linuxRuntime = $true

  Write-Output '[4/6] Uji upload ZIP/file, download, revisi, konflik dan konversi nyata dengan dummy'
  Invoke-LoggedNode -Step 'Integrasi database dan file dummy' -NodeArguments @('tests/integration.mjs') `
    -WorkingDirectory $appRoot -LogDirectory $reportDir -LogName 'integration'
  $report.integration = $true

  Write-Output '[5/6] Uji UI dengan API dummy'
  if (-not $SkipBrowser) {
    Invoke-LoggedNode -Step 'Interaksi UI dan viewport' -NodeArguments @('tests/ui.mjs') `
      -WorkingDirectory $appRoot -LogDirectory $reportDir -LogName 'ui'
    Invoke-LoggedNode -Step 'Sidebar dan layout responsive' -NodeArguments @('tests/layout.mjs') `
      -WorkingDirectory $appRoot -LogDirectory $reportDir -LogName 'layout'
    Invoke-LoggedNode -Step 'Proteksi revisi, upload lintas menu dan pasangan dokumen' -NodeArguments @('tests/ux.mjs') `
      -WorkingDirectory $appRoot -LogDirectory $reportDir -LogName 'ux'
    Invoke-LoggedNode -Step 'Peta Dokumen DUMMY desktop dan mobile' -NodeArguments @('tests/document-map-ui.mjs') `
      -WorkingDirectory $appRoot -LogDirectory $reportDir -LogName 'document-map-ui'
    $report.browserUi = $true
  } else { $report.browserUi = 'skipped; verifikasi manual masih wajib' }

  Write-Output '[6/6] Menyimpan hasil dan membersihkan container test'
  $report.passed = $true
} catch {
  $report.error = $_.Exception.Message
  Write-Warning $report.error
} finally {
  Capture-TestContainer $testApp 'app-container'
  Capture-TestContainer $testDb 'db-container'
  try { Stop-TestContainer $testApp } catch { Write-Warning 'Container aplikasi test perlu diperiksa.' }
  try { Stop-TestContainer $testDb } catch { Write-Warning 'Container database test perlu diperiksa.' }
  try {
    $labelJson = & docker network inspect --format '{{json .Labels}}' $testNetwork 2>$null
    if ($LASTEXITCODE -eq 0 -and ($labelJson | ConvertFrom-Json).'edms.testRun' -eq $runId) { & docker network rm $testNetwork | Out-Null }
  } catch {}
  foreach ($key in $envKeys) { [Environment]::SetEnvironmentVariable($key, $savedEnv[$key], 'Process') }
  $report.finishedAt = (Get-Date).ToString('o')
  $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $reportDir 'result.json') -Encoding utf8
  Pop-Location
}
if (-not $report.passed) { throw "Verifikasi belum lulus. Log: $reportDir" }
Write-Output "VERIFICATION_PASS - hasil: $reportDir"
Write-Output 'Pengujian laptop selesai. Container/database NAS belum diubah.'
