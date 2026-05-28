@echo off
chcp 65001 > nul
title Market Overview 패키지 만들기
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0패키지만들기.ps1"
