@echo off
setlocal ENABLEDELAYEDEXECUTION
title Capstone - Launcher

REM ==== CONFIGURACION ====
set PROJ=F:\Capstone\Proyecto\Aplicacion
set AVD_NAME=Medium_Phone_API_36.0  REM <-- CAMBIA por tu AVD
set ML_VENV=.venv311                REM <-- nombre de tu venv en /ml
set ML_PORT=8001
set API_PORT=3000

echo ==============================
echo 🚀 Iniciando Proyecto Capstone
echo ==============================

REM 0) Infra: Postgres + Redis (Docker)
echo ▶ Infra (Docker): Postgres/Redis...
start "Infra" cmd /k "cd /d %PROJ%\infra && if exist .env (docker compose --env-file .env up -d db redis) else (docker compose up -d db redis)"

REM 1) ML (FastAPI) en puerto %ML_PORT%
echo ▶ ML (FastAPI)...
start "ML" cmd /k "cd /d %PROJ%\ml && if exist %ML_VENV%\Scripts\activate.bat (call %ML_VENV%\Scripts\activate.bat) else (echo [WARN] No venv: %ML_VENV%) && uvicorn main:app --host 0.0.0.0 --port %ML_PORT% --reload"

REM 2) API (NestJS) en puerto %API_PORT%
echo ▶ API (NestJS)...
start "API" cmd /k "cd /d %PROJ%\api && npm run start:dev"

REM 3) Emulador Android (si no está corriendo)
echo ▶ Emulador Android...
start "AndroidEmu" cmd /k "call \"%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe\" -avd %AVD_NAME%"

REM Espera 20s para que el emulador termine de arrancar (ajusta si hace falta)
timeout /t 20 >nul

REM 4) Expo (abre directo en Android, sin presionar 'a')
echo ▶ Expo (Android)...
start "Expo" cmd /k "cd /d %PROJ%\mobile && npx expo start --android"

echo ==============================
echo ✅ Todo lanzado en ventanas separadas.
echo ==============================
pause