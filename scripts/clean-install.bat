@echo off
REM Clean install script for TrafficSlight (Windows)

echo 🧹 Cleaning previous installations...

REM Remove node_modules and lock files
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json
if exist yarn.lock del yarn.lock

REM Clear npm cache
npm cache clean --force

echo 📦 Installing dependencies with retry logic...

REM Install with retry logic
set max_attempts=3
set attempt=1

:retry
echo Attempt %attempt% of %max_attempts%...

npm install --no-audit --no-fund
if %errorlevel% equ 0 (
    echo ✅ Dependencies installed successfully!
    goto :success
) else (
    echo ❌ Installation failed on attempt %attempt%
    
    if %attempt% lss %max_attempts% (
        echo ⏳ Waiting 10 seconds before retry...
        timeout /t 10 /nobreak >nul
        set /a attempt+=1
        goto :retry
    ) else (
        echo 💥 All installation attempts failed
        exit /b 1
    )
)

:success
echo 🎉 Clean install completed!
pause












