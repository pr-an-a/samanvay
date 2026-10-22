#!/usr/bin/env bash
# Stop the Samanvay servers started by start.sh (and any leftover Samanvay server on ports 8000/5173).
# Never touches processes that are not Samanvay's.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
RUN="$ROOT/.run"
QUIET="${1:-}"
say() { [ "$QUIET" = "--quiet" ] || echo "$*"; }

is_ours() {  # backend (uvicorn app.main:app) or this repo's frontend
  local cmd
  cmd="$(ps -o command= -p "$1" 2>/dev/null || true)"
  [[ "$cmd" == *"app.main:app"* || "$cmd" == *"$ROOT/frontend"* || "$cmd" == *"samanvay/frontend"* ]]
}

stop_pid() {
  local pid="$1" name="$2"
  kill -0 "$pid" 2>/dev/null || return 0
  is_ours "$pid" || return 0
  kill "$pid" 2>/dev/null
  for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || { say "Stopped $name (pid $pid)"; return 0; }; sleep 0.25; done
  kill -9 "$pid" 2>/dev/null && say "Force-stopped $name (pid $pid)"
}

for name in backend frontend; do
  if [ -f "$RUN/$name.pid" ]; then
    stop_pid "$(cat "$RUN/$name.pid")" "$name"
    rm -f "$RUN/$name.pid"
  fi
done

# Leftovers, e.g. servers started by hand.
for port in 8000 5173; do
  for pid in $(lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null); do
    if is_ours "$pid"; then
      stop_pid "$pid" "server on port $port"
    else
      echo "Port $port is used by another program (pid $pid: $(ps -o comm= -p "$pid")). Not stopping it." >&2
    fi
  done
done
say "Samanvay is stopped."
