@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title Auto-Story

echo.
echo  ============================
echo    Auto-Story - Starting...
echo  ============================
echo.

:: Check git
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Git not found. Install from https://git-scm.com
    pause
    exit /b 1
)

:: Check bun
where bun >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Bun not found. Install from https://bun.sh
    pause
    exit /b 1
)

:: Auto-update
echo  [1/3] Checking for updates...
git pull --ff-only >nul 2>&1
if %errorlevel% equ 0 (
    echo        Up to date.
) else (
    echo        Updates found - pulling...
    git pull
    if %errorlevel% neq 0 (
        echo        [WARN] Pull failed. Continuing with local version.
    )
)

:: Install dependencies
echo  [2/3] Installing dependencies...
bun install --frozen-lockfile >nul 2>&1
if %errorlevel% neq 0 (
    echo        Lockfile changed - updating...
    bun install
)

:: Start dev server in background, wait for it to be ready, then open browser
echo  [3/3] Starting server...
start /b bun dev

:: Wait for server to respond
set READY=0
for /l %%i in (1,1,30) do (
    if !READY! equ 0 (
        curl -s -o nul -w "" http://localhost:3333/ >nul 2>&1
        if !errorlevel! equ 0 (
            set READY=1
        ) else (
            timeout /t 1 /nobreak >nul
        )
    )
)

if %READY% equ 1 (
    echo        Opening browser...
    start http://localhost:3333/
) else (
    echo        [WARN] Server took too long. Open http://localhost:3333/ manually.
)

echo.
echo  Ready! Press Ctrl+C to stop.
echo.
