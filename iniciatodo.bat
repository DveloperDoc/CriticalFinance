@echo off
title 🚀 CriticalFinance Auto Launcher
color 0A

echo ===================================================
echo INICIANDO AMBIENTE DE CRITICAL FINANCE
echo ===================================================

REM === CONFIGURACIÓN GENERAL ===
set PROJ=C:\CriticalFinance
set AVD_NAME=Medium_Phone_API_36.1
set ML_VENV=.venv311

echo.
echo 🔹 Levantando infraestructura (Postgres + Redis)...
start cmd /k "cd /d %PROJ%\infra && docker compose --env-file .env up -d db redis"

echo.
echo 🔹 Iniciando servicio de Machine Learning...
start cmd /k "cd /d %PROJ%\ml && call %ML_VENV%\Scripts\activate.bat && uvicorn main:app --host 0.0.0.0 --port 8001 --reload"

echo.
echo 🔹 Levantando API (NestJS + Prisma)...
start cmd /k "cd /d %PROJ%\api && npm run start:dev"

echo.
echo 🔹 Iniciando Emulador Android...
start "" "%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe" -avd %AVD_NAME%

echo.
echo ⏳ Esperando que el emulador arranque (20 segundos)...
timeout /t 20 >nul

echo.
echo 🔹 Iniciando aplicación móvil con Expo...
start cmd /k "cd /d %PROJ%\mobile && npx expo start --android"

echo.
echo ===================================================
echo ✅ Todo el entorno de desarrollo está en marcha.
echo ===================================================

pause
exit