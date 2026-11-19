@echo off
title FLOW STUDIO - Generador de Video Multi-Escena
cd /d "%~dp0"

if not exist "node_modules" (
  echo Instalando dependencias...
  call npm install
)

if not exist "dist\index.html" (
  echo Compilando interfaz por primera vez...
  call npm run build
)

echo Iniciando FLOW STUDIO en un puerto libre disponible...
node server/index.js --open
if errorlevel 1 (
  echo.
  echo Ocurrio un error al iniciar FLOW STUDIO.
  pause
)
