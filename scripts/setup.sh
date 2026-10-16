#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export npm_config_cache="${npm_config_cache:-/workspace/.cache/npm}"
export HF_HOME="${HF_HOME:-/workspace/.cache/huggingface}"
export HF_HUB_DISABLE_XET=1
npm ci --no-audit --no-fund
python3 -m venv /workspace/.lifejam-venv --system-site-packages
/workspace/.lifejam-venv/bin/pip install --no-cache-dir 'torch==2.14.1' --index-url https://download.pytorch.org/whl/cpu
/workspace/.lifejam-venv/bin/pip install --no-cache-dir -r semantic/requirements.txt
bash scripts/database.sh
npm run build
if [[ "${1:-}" != '--skip-model' ]]; then
  /workspace/.lifejam-venv/bin/python -c 'from sentence_transformers import SentenceTransformer; SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2", device="cpu")'
fi
