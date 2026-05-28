@echo off
chcp 65001 > nul
title Market Overview
cd /d "%~dp0"

echo.
echo ============================================
echo    Market Overview 서버 시작 중...
echo ============================================
echo.

REM Node.js 확인
where node > nul 2>&1
if errorlevel 1 (
    echo [오류] Node.js가 설치되어 있지 않습니다.
    echo setup.bat을 먼저 실행해주세요.
    echo.
    pause
    exit /b 1
)

REM backend\node_modules 확인
if not exist "%~dp0backend\node_modules" (
    echo [오류] 백엔드 패키지가 설치되어 있지 않습니다.
    echo 처음실행.bat 또는 setup.bat을 먼저 실행해주세요.
    echo.
    pause
    exit /b 1
)

REM frontend 빌드 확인
if not exist "%~dp0frontend\dist\index.html" (
    echo [오류] 프론트엔드 빌드 파일이 없습니다.
    echo 처음실행.bat 또는 setup.bat을 먼저 실행해주세요.
    echo.
    pause
    exit /b 1
)

REM 이미 실행 중인 포트 확인 후 종료
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " ^| findstr "LISTENING" 2^>nul') do (
    echo 포트 3001 사용 중 (PID: %%a) - 종료 중...
    taskkill /PID %%a /F > nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080 " ^| findstr "LISTENING" 2^>nul') do (
    echo 포트 8080 사용 중 (PID: %%a) - 종료 중...
    taskkill /PID %%a /F > nul 2>&1
)

REM 백엔드 시작
echo [1/2] 백엔드 서버 시작 중 (포트 3001)...
start "Market-Backend" cmd /k "title Market-Backend ^& cd /d "%~dp0backend" ^& node server.js"

REM 2초 대기
timeout /t 2 /nobreak > nul

REM 프론트엔드 시작
echo [2/2] 프론트엔드 서버 시작 중 (포트 8080)...
start "Market-Frontend" cmd /k "title Market-Frontend ^& cd /d "%~dp0frontend" ^& node serve-dist.cjs"

timeout /t 2 /nobreak > nul

echo.
echo ============================================
echo    서버 시작 완료!
echo ============================================
echo.
echo    백엔드:   http://localhost:3001
echo    프론트엔드: http://localhost:8080
echo.
echo    브라우저를 열고 있습니다...
echo.

timeout /t 2 /nobreak > nul
start http://localhost:8080

echo    서버를 종료하려면 '종료.bat'을 실행하세요.
echo.
