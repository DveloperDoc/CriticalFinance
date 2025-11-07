@echo off
setlocal enableextensions enabledelayedexpansion
chcp 65001 >nul
title CriticalFinance Dev Launcher
color 0A

:: =============== CONFIG ===============
set "PROJ=C:\criticalfinance"
set "AVD_NAME=Medium_Phone_API_36.1"
set "ML_VENV=.venv311"
set "EMULATOR=%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe"
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
:: =====================================

echo ===================================================
echo INICIANDO AMBIENTE DE CRITICAL FINANCE
echo Raiz: %PROJ%
echo ===================================================
echo.

:: --------- Sanity checks ----------
if not exist "%PROJ%" (
  echo [ERROR] No existe %PROJ%
  goto :end
)
if not exist "%PROJ%\api" (
  echo [ERROR] Falta %PROJ%\api
  goto :end
)
if not exist "%PROJ%\mobile" (
  echo [ERROR] Falta %PROJ%\mobile
  goto :end
)
if not exist "%PROJ%\infra" (
  echo [WARN] Falta %PROJ%\infra. Omitiendo Docker.
)
if not exist "%EMULATOR%" (
  echo [WARN] No se encontro el emulador: %EMULATOR%
)
if not exist "%ADB%" (
  echo [WARN] No se encontro ADB: %ADB%
)
echo.

:: --------- Infra (Docker) ----------
if exist "%PROJ%\infra" (
  echo 🔹 Levantando infraestructura (Postgres + Redis)...
  start "infra" cmd /k "cd /d %PROJ%\infra && docker compose --env-file .env up -d db redis"
) else (
  echo ⏭  Saltando infraestructura
)
echo.

:: --------- ML service ----------
if exist "%PROJ%\ml" (
  echo 🔹 Iniciando servicio de Machine Learning...
  if exist "%PROJ%\ml\%ML_VENV%\Scripts\activate.bat" (
    start "ml" cmd /k "cd /d %PROJ%\ml && call %ML_VENV%\Scripts\activate.bat && uvicorn main:app --host 0.0.0.0 --port 8001 --reload"
  ) else (
    echo [WARN] No se encontro %ML_VENV%. Iniciando sin venv.
    start "ml" cmd /k "cd /d %PROJ%\ml && uvicorn main:app --host 0.0.0.0 --port 8001 --reload"
  )
) else (
  echo ⏭  Saltando ML (no existe %PROJ%\ml)
)
echo.

:: --------- API (NestJS) ----------
echo 🔹 Levantando API (NestJS + Prisma)...
start "api" cmd /k "cd /d %PROJ%\api && npm run start:dev"
echo.

:: --------- Android emulator ----------
if exist "%EMULATOR%" (
  echo 🔹 Iniciando Emulador Android: %AVD_NAME%
  start "emulator" "%EMULATOR%" -avd %AVD_NAME% -netdelay none -netspeed full
  echo ⏳ Esperando ADB...
  if exist "%ADB%" (
    "%ADB%" start-server >nul 2>&1
    call :wait_for_boot 180
  ) else (
    echo [WARN] No hay ADB para verificar el boot. Esperando 20 s.
    timeout /t 20 >nul
  )
) else (
  echo ⏭  Saltando emulador
)
echo.

:: --------- Expo (mobile) ----------
echo 🔹 Iniciando aplicacion movil con Expo...
start "mobile" cmd /k "cd /d %PROJ%\mobile && npx expo start --android"
echo.

echo ===================================================
echo ✅ Entorno de desarrollo lanzado.
echo ===================================================
goto :end


:wait_for_boot
:: Espera hasta que el emulador reporte boot completo o agota tiempo.
:: Uso: call :wait_for_boot <segundos>
set "TIMEOUT_SEC=%~1"
if "%TIMEOUT_SEC%"=="" set TIMEOUT_SEC=180

if not exist "%ADB%" (
  echo [WARN] ADB no disponible. Saltando espera de boot.
  goto :eof
)

echo ⏳ Esperando que el emulador arranque (max %TIMEOUT_SEC%s)...
set /a "elapsed=0"
:loop_boot
for /f "usebackq tokens=*" %%i in (`"%ADB%" shell getprop sys.boot_completed 2^>nul`) do set "boot=%%i"
if "%boot%"=="1" (
  echo ✅ Emulador listo.
  goto :eof
)
timeout /t 2 >nul
set /a "elapsed+=2"
if %elapsed% GEQ %TIMEOUT_SEC% (
  echo [WARN] Tiempo agotado esperando el emulador. Continuando.
  goto :eof
)
goto :loop_boot


:end
pause
endlocal