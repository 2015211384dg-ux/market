#Requires -Version 5.1
<#
.SYNOPSIS
    Market Overview 원터치 설치 스크립트
.DESCRIPTION
    Node.js 설치 확인/설치 -> npm install -> 프론트엔드 빌드 -> 서버 시작
#>
param(
    [switch]$StartAfterInstall,
    [switch]$NoPrompt
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host $Message -ForegroundColor Yellow
}

function Invoke-NpmInstall {
    param(
        [string]$Path,
        [string]$Name
    )

    Write-Host "  $Name 패키지 설치..." -ForegroundColor Cyan
    Push-Location $Path
    try {
        $hasLock = Test-Path (Join-Path $Path "package-lock.json")
        if ($hasLock) {
            & npm ci 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
            if ($LASTEXITCODE -ne 0) {
                Write-Host "    npm ci 실패, npm install로 재시도합니다." -ForegroundColor Yellow
                & npm install 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
            }
        } else {
            & npm install 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
        }
        if ($LASTEXITCODE -ne 0) { throw "$Name npm install 실패" }
    } finally {
        Pop-Location
    }
    Write-Host "  $Name 패키지 완료" -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   Market Overview - 자동 설치 프로그램    " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ─── 1. Node.js 설치 확인 ────────────────────────────────────────────────────
Write-Step "[1/6] Node.js 확인 중..."

$nodeInstalled = $false
try {
    $nodeVer = & node --version 2>&1
    if ($nodeVer -match "v\d+") {
        $nodeInstalled = $true
        Write-Host "  Node.js 이미 설치됨: $nodeVer" -ForegroundColor Green
    }
} catch {}

if (-not $nodeInstalled) {
    Write-Host "  Node.js가 없습니다. 자동 설치합니다..." -ForegroundColor Yellow

    # winget 시도 (Windows 10/11)
    $wingetOk = $false
    try {
        $wg = & winget --version 2>&1
        if ($wg -match "\d+\.\d+") { $wingetOk = $true }
    } catch {}

    if ($wingetOk) {
        Write-Host "  winget으로 Node.js LTS 설치 중 (잠시 기다려주세요)..." -ForegroundColor Cyan
        & winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    } else {
        Write-Host "  Node.js 설치 파일 다운로드 중..." -ForegroundColor Cyan
        $msiPath = "$env:TEMP\nodejs-installer.msi"
        $nodeUrl = "https://nodejs.org/dist/v20.19.1/node-v20.19.1-x64.msi"
        try {
            Invoke-WebRequest -Uri $nodeUrl -OutFile $msiPath -UseBasicParsing
            Write-Host "  Node.js 설치 중..." -ForegroundColor Cyan
            Start-Process msiexec.exe -Wait -ArgumentList "/i `"$msiPath`" /quiet /norestart ADDLOCAL=ALL"
            Remove-Item $msiPath -Force -ErrorAction SilentlyContinue
        } catch {
            Write-Host ""
            Write-Host "[오류] Node.js 자동 설치에 실패했습니다." -ForegroundColor Red
            Write-Host "https://nodejs.org 에서 Node.js LTS를 수동으로 설치 후 다시 실행하세요." -ForegroundColor Red
            Write-Host ""
            Read-Host "아무 키나 눌러 종료"
            exit 1
        }
    }

    # PATH 새로고침
    $machinePath = [System.Environment]::GetEnvironmentVariable("PATH", "Machine")
    $userPath    = [System.Environment]::GetEnvironmentVariable("PATH", "User")
    $env:PATH    = "$machinePath;$userPath;$env:ProgramFiles\nodejs"

    try {
        $nodeVer = & node --version 2>&1
        Write-Host "  Node.js 설치 완료: $nodeVer" -ForegroundColor Green
    } catch {
        Write-Host ""
        Write-Host "[오류] Node.js 설치 후에도 인식되지 않습니다." -ForegroundColor Red
        Write-Host "PC를 재시작한 후 setup.ps1을 다시 실행하세요." -ForegroundColor Red
        Write-Host ""
        Read-Host "아무 키나 눌러 종료"
        exit 1
    }
}

# ─── 2. 디렉토리 생성 ────────────────────────────────────────────────────────
Write-Step "[2/6] 필요 폴더 생성 중..."

$logsDir     = Join-Path $scriptDir "logs"
$screenerDir = Join-Path $scriptDir "screener-exports"

foreach ($dir in @($logsDir, $screenerDir)) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
        Write-Host "  생성됨: $dir" -ForegroundColor Gray
    }
}

# ─── 3. .env 설정 ────────────────────────────────────────────────────────────
Write-Step "[3/6] 환경설정 파일 확인 중..."

$envFile    = Join-Path $scriptDir "backend\.env"
$envExample = Join-Path $scriptDir "backend\.env.example"

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Host "  .env 파일을 생성했습니다. (backend\.env)" -ForegroundColor Yellow
        Write-Host "  필요 시 backend\.env 파일에서 API 키를 수정하세요." -ForegroundColor Yellow
    } else {
        $defaultEnv = @(
            "FINNHUB_API_KEY=",
            "ANTHROPIC_API_KEY=",
            "PORT=3001",
            "FRED_API_KEY=",
            "ALPHA_VANTAGE_API_KEY=",
            "DART_API_KEY=",
            "KIS_APP_KEY=",
            "KIS_APP_SECRET=",
            "KIS_ACCOUNT_NO=",
            "KIS_ACCOUNT_PROD=01"
        ) -join "`r`n"
        Set-Content -Path $envFile -Value $defaultEnv -Encoding UTF8
        Write-Host "  .env.example이 없어 기본 backend\.env를 생성했습니다." -ForegroundColor Yellow
    }
} else {
    Write-Host "  .env 파일 확인됨" -ForegroundColor Green
}

# SCREENER_EXPORT_DIR를 현재 설치 경로로 업데이트
$envContent = Get-Content $envFile -Raw -Encoding UTF8 -ErrorAction Stop
$newScreenerDir = $screenerDir
if ($envContent -match "SCREENER_EXPORT_DIR=") {
    $envContent = $envContent -replace "(?m)^\s*SCREENER_EXPORT_DIR=.*$", "SCREENER_EXPORT_DIR=$newScreenerDir"
} else {
    $envContent += "`nSCREENER_EXPORT_DIR=$newScreenerDir"
}
Set-Content -Path $envFile -Value $envContent -Encoding UTF8 -NoNewline

Write-Host "  SCREENER_EXPORT_DIR 경로 자동 설정됨" -ForegroundColor Green

# ─── 4. npm 확인 ─────────────────────────────────────────────────────────────
Write-Step "[4/6] npm 확인 중..."
try {
    $npmVer = & npm --version 2>&1
    Write-Host "  npm 확인됨: $npmVer" -ForegroundColor Green
} catch {
    Write-Host "[오류] npm을 찾을 수 없습니다. Node.js LTS 설치 상태를 확인하세요." -ForegroundColor Red
    exit 1
}

# ─── 5. npm install ───────────────────────────────────────────────────────────
Write-Step "[5/6] 패키지 설치 중..."

Invoke-NpmInstall -Path (Join-Path $scriptDir "backend") -Name "백엔드"
Invoke-NpmInstall -Path (Join-Path $scriptDir "frontend") -Name "프론트엔드"

# ─── 6. 프론트엔드 빌드 ──────────────────────────────────────────────────────
Write-Step "[6/6] 프론트엔드 빌드 중..."

Push-Location (Join-Path $scriptDir "frontend")
try {
    & npm run build 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    if ($LASTEXITCODE -ne 0) { throw "프론트엔드 빌드 실패" }
} finally { Pop-Location }
Write-Host "  빌드 완료" -ForegroundColor Green

# ─── 완료 ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "   설치 완료!                               " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  이제 '시작.bat' 파일을 더블클릭하면 서버가 실행됩니다." -ForegroundColor Cyan
Write-Host "  브라우저에서 http://localhost:8080 으로 접속하세요." -ForegroundColor Cyan
Write-Host ""

if ($StartAfterInstall) {
    Start-Process (Join-Path $scriptDir "시작.bat")
    exit 0
}

if (-not $NoPrompt) {
    $startNow = Read-Host "지금 바로 서버를 시작하시겠습니까? (Y/N)"
    if ($startNow -match "^[Yy]") {
        Start-Process (Join-Path $scriptDir "시작.bat")
    }
}
