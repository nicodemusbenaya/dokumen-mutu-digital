function Invoke-LoggedNode {
  param(
    [Parameter(Mandatory=$true)][string]$Step,
    [Parameter(Mandatory=$true)][string[]]$NodeArguments,
    [Parameter(Mandatory=$true)][string]$WorkingDirectory,
    [Parameter(Mandatory=$true)][string]$LogDirectory,
    [Parameter(Mandatory=$true)][string]$LogName
  )
  # Arguments used by the verifier are fixed flags and relative script paths.
  # Fail explicitly instead of silently misquoting a future argument on PS 5.1.
  foreach ($argument in $NodeArguments) {
    if ($argument -match '[\s"]') { throw 'Runner memerlukan argument Node tanpa spasi/quote.' }
  }
  $nodeExe = (Get-Command node -ErrorAction Stop).Source
  $stdoutPath = Join-Path $LogDirectory ($LogName + '-stdout.log')
  $stderrPath = Join-Path $LogDirectory ($LogName + '-stderr.log')
  $process = Start-Process -FilePath $nodeExe -ArgumentList $NodeArguments `
    -WorkingDirectory $WorkingDirectory -WindowStyle Hidden -Wait -PassThru `
    -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
  if (Test-Path -LiteralPath $stdoutPath) { Get-Content -LiteralPath $stdoutPath }
  if (Test-Path -LiteralPath $stderrPath) {
    # Output as ordinary text; do not reintroduce NativeCommandError truncation.
    Get-Content -LiteralPath $stderrPath
  }
  if ($process.ExitCode -ne 0) {
    throw "$Step gagal (exit $($process.ExitCode)). Detail lengkap: $stderrPath"
  }
}
