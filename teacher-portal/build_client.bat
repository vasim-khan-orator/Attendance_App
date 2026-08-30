@echo off
:: ============================================================
::  build_client.bat — Build AttendanceClient.exe
::  Run this from the teacher-portal directory, or just
::  double-click it.
:: ============================================================

title Build: AttendanceClient.exe
cd /d "%~dp0"

echo.
echo  =====================================================
echo   Attendance App — Building Client Executable
echo  =====================================================
echo.

:: --- Check Node.js ---
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)

:: --- Install npm dependencies (incl. Electron + electron-builder) ---
echo [INFO] Installing npm dependencies...
echo        (This may take a few minutes the first time — Electron is ~100MB)
echo.
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
)

:: --- Build React frontend ---
echo.
echo [INFO] Building React frontend...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Vite build failed.
    pause
    exit /b 1
)

:: --- Package with electron-builder ---
echo.
echo [INFO] Packaging with electron-builder...
call npm run electron:build
if %errorlevel% neq 0 (
    echo [ERROR] electron-builder failed. Check the output above.
    pause
    exit /b 1
)

echo.
echo  =====================================================
echo   SUCCESS!
echo   Output: teacher-portal\release\AttendanceClient.exe
echo  =====================================================
echo.
pause
