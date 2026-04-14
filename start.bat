@echo off
setlocal
cd /d "%~dp0backend"

if not exist ".env" (
  echo No backend\.env found. Copy backend\.env.example to backend\.env and configure your keys.
)

if not exist "node_modules" (
  call npm.cmd install
  if errorlevel 1 exit /b %errorlevel%
)

call npm.cmd start

