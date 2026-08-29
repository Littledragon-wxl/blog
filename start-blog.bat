@echo off
rem 本地预览服务器（开机自启用，blog-autostart.vbs 调用本文件）
cd /d "%~dp0"
start "blog-server" /min python -m http.server 8765
