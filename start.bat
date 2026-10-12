@echo off
cd /d "%~dp0"
if not exist node_modules (
    echo Run npm ci once before starting.
    exit /b 1
)
if not exist dist\server.cjs (
    echo Run npm run build before starting.
    exit /b 1
)
call npm start
