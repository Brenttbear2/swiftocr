@echo off
cd /d "%~dp0"

for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
    ping 127.0.0.1 -n 2 >nul
)

start /b cmd /c "ping 127.0.0.1 -n 5 >nul & start http://127.0.0.1:8000"

echo Starting Invoice OCR service at http://127.0.0.1:8000
echo Keep this window open. Press Ctrl+C to stop.
echo.
"%~dp0.venv\Scripts\python.exe" -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000

echo.
echo Service stopped.
pause