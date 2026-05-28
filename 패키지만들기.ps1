#Requires -Version 5.1
param(
    [switch]$NoOpen,
    [switch]$NoPrompt
)

$ErrorActionPreference = "Stop"

$src = Split-Path -Parent $MyInvocation.MyCommand.Path
$timestamp = Get-Date -Format "yyyyMMdd_HHmm"
$zipName = "Market_Migration_$timestamp.zip"
$zipPath = Join-Path $src $zipName

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   Market Overview - 이전용 패키지 생성    " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  출처: $src" -ForegroundColor Gray
Write-Host "  저장: $zipPath" -ForegroundColor Gray
Write-Host ""

# node_modules, dist, logs, .git, .claude 제외하고 임시 폴더로 복사
$tempDir = Join-Path $env:TEMP "market_pack_$timestamp"
$tempMarket = Join-Path $tempDir "Market"

if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempMarket | Out-Null

$excludeDirs  = @("node_modules", ".git", ".claude", "logs", "dist")
$excludeFiles = @("tmp_mvp_q.json", "tmp_test.json", $zipName)

Write-Host "파일 복사 중 (node_modules, dist 제외)..." -ForegroundColor Yellow

function Copy-Filtered {
    param($Source, $Dest)
    if (-not (Test-Path $Dest)) { New-Item -ItemType Directory -Path $Dest | Out-Null }
    Get-ChildItem -Path $Source -Force | ForEach-Object {
        if ($_.PSIsContainer) {
            if ($excludeDirs -notcontains $_.Name) {
                Copy-Filtered -Source $_.FullName -Dest (Join-Path $Dest $_.Name)
            }
        } else {
            $isExcludedFile = $excludeFiles -contains $_.Name
            $isZipPackage = $_.Name -like "Market_Migration_*.zip"
            if (-not $isExcludedFile -and -not $isZipPackage) {
                Copy-Item -Path $_.FullName -Destination (Join-Path $Dest $_.Name) -Force
            }
        }
    }
}

Copy-Filtered -Source $src -Dest $tempMarket

$packedEnv = Join-Path $tempMarket "backend\.env"
if (-not (Test-Path $packedEnv)) {
    throw "backend\.env 파일이 없어 API 키를 포함한 이전 패키지를 만들 수 없습니다."
}

Write-Host "backend\.env 포함 확인됨 (API 키/환경설정 이전됨)" -ForegroundColor Green

# 빈 디렉토리 보장
foreach ($dir in @("logs", "screener-exports")) {
    $d = Join-Path $tempMarket $dir
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d | Out-Null }
    # .gitkeep 파일로 빈 폴더 보존
    [System.IO.File]::WriteAllText((Join-Path $d ".gitkeep"), "", [System.Text.UTF8Encoding]::new($false))
}

$guide = @"
Market Overview Migration Guide
===============================

1. Extract this ZIP file on the new PC.
   Example: C:\Market or D:\Market

2. Double-click '처음실행.bat' inside the extracted Market folder.
   It automatically runs:
   - Node.js LTS check/install
   - backend/frontend npm package install
   - frontend build
   - backend: http://localhost:3001
   - frontend: http://localhost:8080 and browser open

3. After the first setup, use '시작.bat' to start and '종료.bat' to stop.

Notes:
- API keys and existing environment settings are included in backend\.env.
- setup.ps1 automatically rewrites SCREENER_EXPORT_DIR for the new install path.
- Internet access is required during setup for Node.js and npm packages.
"@
[System.IO.File]::WriteAllText((Join-Path $tempMarket "MIGRATION_README.txt"), $guide, [System.Text.UTF8Encoding]::new($false))

Write-Host "zip 압축 중..." -ForegroundColor Yellow
Compress-Archive -Path $tempMarket -DestinationPath $zipPath -CompressionLevel Optimal -Force
Remove-Item $tempDir -Recurse -Force

$sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "   패키지 생성 완료!                        " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  파일: $zipPath" -ForegroundColor Cyan
Write-Host "  크기: $sizeMB MB" -ForegroundColor Cyan
Write-Host ""
Write-Host "다른 PC에서 사용하는 방법:" -ForegroundColor Yellow
Write-Host "  1. zip 파일을 다른 PC로 복사"
Write-Host "  2. 원하는 위치에 압축 해제 (예: C:\Market 또는 D:\Market 등)"
Write-Host "  3. 폴더 안의 처음실행.bat 더블클릭 → 자동 설치 및 실행"
Write-Host "  4. 이후부터는 시작.bat / 종료.bat 사용"
Write-Host ""

# 저장 폴더 열기
if (-not $NoOpen) {
    try {
        Start-Process explorer.exe (Split-Path $zipPath -Parent)
    } catch {}
}

if (-not $NoPrompt) {
    Read-Host "아무 키나 눌러 종료"
}
