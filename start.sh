#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/backend"

if [ ! -f ".env" ]; then
  echo "No backend/.env found. Copy backend/.env.example to backend/.env and configure your keys."
fi

if [ ! -d "node_modules" ]; then
  npm install
fi

npm start

