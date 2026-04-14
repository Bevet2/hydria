#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
export OLLAMA_MODELS="$ROOT/ollama/models"

mkdir -p "$OLLAMA_MODELS"
exec ollama serve
