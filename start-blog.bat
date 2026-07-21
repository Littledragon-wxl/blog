@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title 个人博客 - 本地服务

set "PORT=8765"
set "DIR=%~dp0"
set "PY=python"

echo ============================================
echo    个人博客本地服务  端口 %PORT%
echo    目录: %DIR%
echo ============================================
echo.

REM 检查服务是否已在运行
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://localhost:%PORT%/' -UseBasicParsing -TimeoutSec 2).StatusCode | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
if !errorlevel!==0 (
  echo [提示] 服务已在运行，直接打开浏览器...
  start "" "http://localhost:%PORT%/"
  timeout /t 2 /nobreak >nul
  exit /b 0
)

echo [启动] 正在启动本地服务器...
echo [访问] http://localhost:%PORT%/
echo [关闭] 直接关闭此窗口即可停止服务
echo.

start "" "http://localhost:%PORT%/"
"%PY%" -m http.server %PORT% --directory "%DIR%"
