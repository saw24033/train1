@echo off
echo Starting Rojo with hot reloading and two-way sync...
rojo serve --port 34872 --watch
echo.
echo Rojo server running on port 34872
echo Two-way sync enabled
echo Connect in Studio to: localhost:34872
echo.
pause