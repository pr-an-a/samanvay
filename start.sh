#!/usr/bin/env bash
# Start Samanvay for a demo: set up what's missing, reseed, start backend + frontend, wait until healthy.
#
#   ./start.sh                       demo mode (default): no automatic SLA job, "Reset demo data" button
#   SAMANVAY_DEMO=0 ./start.sh       normal mode: SLA check runs every few minutes, no reset button
#   SAMANVAY_HOST=0.0.0.0 ./start.sh also reachable from other devices on this network
#
# Servers run detached and keep running after this terminal closes. Stop them with ./stop.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
RUN="$ROOT/.run"
HOST="${SAMANVAY_HOST:-127.0.0.1}"
export SAMANVAY_DEMO="${SAMANVAY_DEMO:-1}"
mkdir -p "$RUN"

say() { printf '\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\033[31mError: %s\033[0m\n' "$*" >&2; exit 1; }
hash_of() { shasum -a 256 "$1" | cut -d' ' -f1; }

# Run a command in its own session so it survives this shell (and any parent terminal) exiting.
detach() {
  local name="$1"; shift
  nohup python3 -c 'import os, sys; os.setsid(); os.execvp(sys.argv[1], sys.argv[1:])' "$@" \
    > "$RUN/$name.log" 2>&1 < /dev/null &
  echo $! > "$RUN/$name.pid"
}

wait_for() {
  local url="$1" name="$2"
  for _ in $(seq 1 60); do
    curl -sf "$url" > /dev/null 2>&1 && return 0
    sleep 1
  done
  echo "--- last lines of $RUN/$name.log ---" >&2
  tail -20 "$RUN/$name.log" >&2 || true
  fail "$name did not become healthy at $url"
}

command -v python3 > /dev/null || fail "python3 not found (needs Python 3.11 or newer)"
python3 -c 'import sys; sys.exit(sys.version_info < (3, 11))' || fail "Python 3.11 or newer is required"
command -v npm > /dev/null || fail "npm not found (needs Node.js 20 or newer)"

say "Stopping any earlier Samanvay servers…"
"$ROOT/stop.sh" --quiet || true

say "Backend: checking Python packages…"
cd "$ROOT/backend"
[ -x .venv/bin/python ] || python3 -m venv .venv
if [ "$(cat .venv/.requirements.sha 2>/dev/null || true)" != "$(hash_of requirements.txt)" ]; then
  .venv/bin/pip install -q --disable-pip-version-check -r requirements.txt || fail "pip install failed (first-time setup needs internet)"
  hash_of requirements.txt > .venv/.requirements.sha
fi

say "Frontend: checking Node packages and building…"
cd "$ROOT/frontend"
if [ ! -d node_modules ] || [ "$(cat node_modules/.package-lock.sha 2>/dev/null || true)" != "$(hash_of package-lock.json)" ]; then
  npm install --no-audit --no-fund --loglevel=error || fail "npm install failed (first-time setup needs internet)"
  hash_of package-lock.json > node_modules/.package-lock.sha
fi
./node_modules/.bin/vite build --logLevel error || fail "frontend build failed"

say "Loading fresh demo data…"
cd "$ROOT/backend"
.venv/bin/python -m app.seed

say "Starting servers…"
detach backend "$ROOT/backend/.venv/bin/uvicorn" app.main:app --app-dir "$ROOT/backend" --host "$HOST" --port 8000
# `vite preview` serves the production build and forwards /api to the backend (same proxy as the dev server).
detach frontend "$ROOT/frontend/node_modules/.bin/vite" preview "$ROOT/frontend" --config "$ROOT/frontend/vite.config.js" \
  --host "$HOST" --port 5173 --strictPort

wait_for "http://127.0.0.1:8000/health" backend
wait_for "http://127.0.0.1:5173/" frontend
wait_for "http://127.0.0.1:5173/api/health" frontend

echo
say "Samanvay is running:  http://localhost:5173"
[ "$HOST" = "0.0.0.0" ] && echo "Other devices on this network: http://$(ipconfig getifaddr en0 2>/dev/null || hostname):5173"
if [ "$SAMANVAY_DEMO" = "1" ]; then
  echo "Demo mode: SLA alerts appear only when you press \"Run check now\"; Admin can reset demo data."
else
  echo "Normal mode: the SLA check runs automatically every few minutes."
fi
echo "Logs: $RUN/backend.log, $RUN/frontend.log    Stop: ./stop.sh"
