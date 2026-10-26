@echo off
rem Double-click to play: starts the local game server and opens the game in Chrome.
rem Keep this window open while playing; close it to stop the server.
title DeadFront game server
cd /d "%~dp0"
start "" cmd /c "timeout /t 2 /nobreak >nul & start chrome http://localhost:5173"
node serve.js
pause
