@echo off
chcp 65001 >nul
setlocal
title Push to GitHub

REM ====== Edit this line: your GitHub repo URL ======
set "REMOTE=https://github.com/Littledragon-wxl/blog.git"
REM ==================================================

cd /d "%~dp0"

git remote get-url origin >nul 2>nul
if errorlevel 1 (
  git remote add origin "%REMOTE%"
) else (
  git remote set-url origin "%REMOTE%"
)

echo Pushing to GitHub...
git push -u origin main
if errorlevel 1 (
  echo.
  echo [FAILED] Push failed. Check:
  echo   1. REMOTE URL is correct in this file
  echo   2. Use Personal Access Token as password (not account password)
  echo   3. Repo exists on GitHub
  echo   4. Token scope: repo (classic) or Contents:Read/Write (fine-grained)
)
pause
