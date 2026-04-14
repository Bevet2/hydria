@echo off
setlocal

set "ROOT=%~dp0"
set "OLLAMA_MODELS=%ROOT%ollama\models"

if not exist "%OLLAMA_MODELS%" (
  mkdir "%OLLAMA_MODELS%"
)

echo Starting Ollama with models in "%OLLAMA_MODELS%"
start "Hydria Ollama" /min ollama serve
