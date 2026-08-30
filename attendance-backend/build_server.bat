@echo off
:: ============================================================
::  build_server.bat — Build AttendanceServer.exe
::  Run this from the attendance-backend directory, or just
::  double-click it.
:: ============================================================

title Build: AttendanceServer.exe
cd /d "%~dp0"

echo.
echo  =====================================================
echo   Attendance App — Building Server Executable
echo  =====================================================
echo.

:: --- Check Python ---
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Please install Python 3.10+ and add it to PATH.
    pause
    exit /b 1
)

:: --- Activate virtual environment if present ---
if exist "venv\Scripts\activate.bat" (
    echo [INFO] Activating virtual environment...
    call venv\Scripts\activate.bat
) else (
    echo [WARN] No virtual environment found. Using system Python.
    echo        To create one: python -m venv venv
    echo.
)

:: --- Install / upgrade dependencies ---
echo [INFO] Installing dependencies...
pip install -r requirements.txt --quiet
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install requirements.
    pause
    exit /b 1
)

:: --- Install PyInstaller ---
echo [INFO] Installing PyInstaller...
pip install pyinstaller --quiet

:: --- Clean previous build artifacts ---
echo [INFO] Cleaning previous build...
if exist "build" rmdir /s /q "build"
if exist "dist\AttendanceServer.exe" del /f /q "dist\AttendanceServer.exe"

:: --- Run PyInstaller ---
echo [INFO] Running PyInstaller...
echo.
pyinstaller attendance.spec

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] PyInstaller failed. Check the output above for details.
    pause
    exit /b 1
)

echo.
echo  =====================================================
echo   SUCCESS!
echo   Output: attendance-backend\dist\AttendanceServer.exe
echo  =====================================================
echo.
pause
