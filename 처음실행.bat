@echo off
chcp 65001 > nul
title Market Overview 처음 실행
cd /d "%~dp0"

echo.
echo ============================================
echo    Market Overview - 원터치 설치 및 실행
echo ============================================
echo.
echo Node.js, npm 패키지, 프론트엔드 빌드를 자동 설정한 뒤 서버를 시작합니다.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1" -StartAfterInstall

if errorlevel 1 (
    echo.
    echo [오류] 설치 또는 실행 준비 중 문제가 발생했습니다.
    echo 위 오류 내용을 확인하고 다시 시도해주세요.
    echo.
    pause
    exit /b 1
)

