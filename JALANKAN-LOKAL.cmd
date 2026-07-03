@echo off
REM ============================================================
REM  Agate Level Up - AI-Powered B2B Sales Training (local run)
REM  Double-click this file to serve the site at localhost:8000
REM ============================================================
cd /d "%~dp0"
echo.
echo   Menjalankan Level Up B2B Sales Training di http://127.0.0.1:8000/
echo   Tekan Ctrl+C untuk berhenti.
echo.
start "" http://127.0.0.1:8000/
python -m http.server 8000 --bind 127.0.0.1
pause
