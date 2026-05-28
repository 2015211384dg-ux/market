@echo off
chcp 65001 > nul
title Market Overview 설치

echo.
echo ============================================
echo    Market Overview - 설치 시작
echo ============================================
echo.
echo PowerShell 설치 스크립트를 실행합니다...
echo.

REM PowerShell 실행 정책 우회하여 setup.ps1 실행
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"

if errorlevel 1 (
    echo.
    echo [오류] 설치 중 문제가 발생했습니다.
    echo 오류 내용을 확인하고 다시 시도해주세요.
    echo.
)

pause
