#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$ROOT_DIR/web"
PYTHON_BIN="$ROOT_DIR/.venv/bin/python"

cd "$WEB_DIR"

if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

npm run build

cd "$ROOT_DIR"
"$PYTHON_BIN" manage.py collectstatic --noinput