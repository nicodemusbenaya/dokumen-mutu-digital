param([string]$Tag='edms-ups:2.1.3', [string]$CacheFrom='edms-ups:2.1.2', [switch]$Verify, [switch]$UseHostNetwork)
$ErrorActionPreference='Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
 docker info --format '{{.OSType}}' | Out-Null
 if($LASTEXITCODE -ne 0){throw 'Docker Linux di laptop belum tersedia. Jangan build di NAS.'}
 New-Item -ItemType Directory -Path release -Force | Out-Null
 $buildArgs=@('build','--platform','linux/amd64','--tag',$Tag)
 if($CacheFrom){$null=& docker image inspect $CacheFrom 2>$null;if($LASTEXITCODE -eq 0){$buildArgs+=@('--cache-from',$CacheFrom)}}
 if($UseHostNetwork){$buildArgs+=@('--network','host')}
 $buildArgs+='.'
 & docker @buildArgs
 if($LASTEXITCODE -ne 0){throw 'Build Linux gagal; tidak ada paket siap deploy.'}
 docker image inspect $Tag --format '{{.Os}}/{{.Architecture}}' | Set-Content release/platform.txt
 if((Get-Content release/platform.txt -Raw).Trim() -ne 'linux/amd64'){throw 'Arsitektur image salah'}
 docker save --output release/edms-ups-2.1.3.tar $Tag
 if($LASTEXITCODE -ne 0){throw 'Export image gagal'}
 (Get-FileHash -LiteralPath release/edms-ups-2.1.3.tar -Algorithm SHA256).Hash | Set-Content release/SHA256.txt
 if ($Verify) {
  & (Join-Path $PSScriptRoot 'verify-release.ps1') -Tag $Tag
 } else {
  Write-Output 'Image Linux siap; selesaikan backup/restore dan dummy integration sebelum cutover.'
 }
} finally {Pop-Location}
