@echo off
chcp 65001 >nul
setlocal
title Push to GitLab

REM ====== Edit this line: your GitLab repo URL ======
set "REMOTE=https://gitlab.com/USERNAME/REPO.git"
REM =================================================

cd /d "%~dp0"

git remote get-url origin >nul 2>nul
if errorlevel 1 (
  git remote add origin "%REMOTE%"
) else (
  git remote set-url origin "%REMOTE%"
)

echo Pushing to GitLab...
git push -u origin main
if errorlevel 1 (
  echo.
  echo [FAILED] Push failed. Check:
  echo   1. REMOTE URL is correct in this file
  echo   2. You have access (use Personal Access Token as password for HTTPS)
  echo   3. Repo exists on GitLab
)
pause
