@echo off
echo Starting development environment...
echo.
echo 1. Starting Rojo server...
start "Rojo Server" cmd /k "rojo serve --port 34872"
timeout /t 2 /nobreak >nul
echo.
echo 2. Starting TypeScript watch mode...
start "TypeScript Watch" cmd /k "npm run watch"
echo.
echo Development environment started!
echo - Rojo server running on port 34872
echo - TypeScript compiler watching for changes
echo.
echo Connect Rojo plugin in Studio to: localhost:34872
echo.
pause