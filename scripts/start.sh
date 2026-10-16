#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export HF_HOME="${HF_HOME:-/workspace/.cache/huggingface}"
export HF_HUB_DISABLE_XET=1
bash scripts/database.sh
mkdir -p data
semantic_pid=''
cleanup() { [[ -z "$semantic_pid" ]] || kill "$semantic_pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
if ! curl -fsS http://127.0.0.1:8001/health >/dev/null 2>&1; then
 /workspace/.lifejam-venv/bin/python -m uvicorn semantic.app:app --host 127.0.0.1 --port 8001 >data/semantic.log 2>&1 &
 semantic_pid=$!
 for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8001/health >/dev/null 2>&1; then break; fi
  if ! kill -0 "$semantic_pid" 2>/dev/null; then
   printf '%s\n' 'SBERT did not start. See data/semantic.log. Search will use its labeled keyword fallback.' >&2
   break
  fi
  sleep 1
 done
fi
if [[ "${1:-}" == '--dev' ]]; then node server/index.js; else NODE_ENV=production node server/index.js; fi
