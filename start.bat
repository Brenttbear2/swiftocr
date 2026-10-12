@echo off
rem SwiftOCR launcher for Windows. All the work (and the Chinese messages) is in start.py,
rem because cmd cannot reliably read a batch file containing UTF-8 Chinese text.
cd /d "%~dp0"

where py >nul 2>nul
if not errorlevel 1 (
    py -3 start.py
    goto done
)
where python >nul 2>nul
if not errorlevel 1 (
    python start.py
    goto done
)
echo Python not found. Please install Python 3.11 or later: https://www.python.org/downloads/

:done
pause
