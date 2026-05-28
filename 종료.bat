@echo off
chcp 65001 > nul
title Market Overview 종료

echo.
echo Market Overview 서버를 종료합니다...
echo.

REM 포트 3001, 8080에서 실행 중인 프로세스 종료
set killed=0

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " ^| findstr "LISTENING" 2^>nul') do (
    echo 백엔드(3001) 종료 중 - PID %%a
    taskkill /PID %%a /F > nul 2>&1
    set killed=1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080 " ^| findstr "LISTENING" 2^>nul') do (
    echo 프론트엔드(8080) 종료 중 - PID %%a
    taskkill /PID %%a /F > nul 2>&1
    set killed=1
)

REM Market 서버 창 닫기
taskkill /FI "WINDOWTITLE eq Market-Backend" /F > nul 2>&1
taskkill /FI "WINDOWTITLE eq Market-Frontend" /F > nul 2>&1

if %killed%==0 (
    echo 실행 중인 서버가 없습니다.
) else (
    echo 서버 종료 완료.
)

echo.
timeout /t 2 /nobreak > nul
