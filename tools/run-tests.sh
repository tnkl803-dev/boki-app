#!/bin/bash
# Run async tests via HTTP result callback.
# Usage: cd repo && bash tools/run-tests.sh
# Override port: PORT=9999 bash tools/run-tests.sh
#
# Design notes (see .superpowers/sdd/2026-09-25-boki-app-v1/task-3-report.md,
# "Harness fix round 2" / "round 3"):
# - Never taskkill by /IM (image name) -- that kills the user's real
#   Edge/Python processes too. Only ever kill by exact Windows PID.
# - git-bash mangles /F /IM /PID as path globs; use the // form instead
#   (taskkill //F //PID <pid> //T).
# - $! from bash is an MSYS pid, not the Windows PID. serve.py writes its
#   real os.getpid() to a pidfile we pass in; Edge's real Windows PID(s)
#   are found via a unique --user-data-dir token and PowerShell CIM lookup.
# - Each run uses a fresh, unique --user-data-dir so a leftover headless
#   Edge profile lock can never cause the new instance to hand off the
#   URL to an old (possibly already-dead) instance and exit immediately.
# - serve.py also self-terminates via a watchdog timer if it never
#   receives a POST, so it can't become a permanent zombie listener.
# - Edge spawns child processes (renderer/GPU) that inherit the same
#   --user-data-dir and therefore also match our CIM filter; ALL matches
#   must be killed, not just the first, or a child's parent can survive.
# - The port-busy precheck must never blindly kill whatever holds the
#   port -- only kill it if it's actually our own leftover python.exe.

set -u

PORT="${PORT:-8765}"
RESULT_FILE=".superpowers/test-result.txt"
PIDFILE=$(mktemp)
EDGE_PROFILE=$(mktemp -d)
SERVER_PID=""
EDGE_PIDS=""

EDGE_PROFILE_WIN=$(cygpath -w "$EDGE_PROFILE" 2>/dev/null || echo "$EDGE_PROFILE")
EDGE_PROFILE_ESCAPED=$(printf '%s' "$EDGE_PROFILE_WIN" | sed "s/'/''/g")

# Query CIM for every msedge.exe (main + any child renderer/GPU processes)
# whose command line contains this run's unique profile path. Prints one
# PID per line (may be empty).
resolve_edge_pids() {
  powershell.exe -NoProfile -Command \
    "(Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { \$_.CommandLine -like '*${EDGE_PROFILE_ESCAPED}*' } | Select-Object -ExpandProperty ProcessId)" \
    2>/dev/null | tr -d '\r' | grep -E '^[0-9]+$'
}

cleanup() {
  if [ -n "${SERVER_PID:-}" ]; then
    taskkill //F //PID "$SERVER_PID" //T >/dev/null 2>&1 || true
  fi

  # Re-resolve Edge PIDs in case the earlier lookup (right after launch)
  # came back empty -- retry briefly rather than skip killing Edge.
  if [ -z "${EDGE_PIDS:-}" ]; then
    for i in 1 2 3 4 5 6; do
      EDGE_PIDS=$(resolve_edge_pids)
      [ -n "$EDGE_PIDS" ] && break
      sleep 0.5
    done
  fi
  for p in $EDGE_PIDS; do
    taskkill //F //PID "$p" //T >/dev/null 2>&1 || true
  done

  # Verify no msedge.exe tagged with this run's profile token survives;
  # warn (don't fail the whole script) if any do.
  REMAINING=$(resolve_edge_pids)
  if [ -n "$REMAINING" ]; then
    echo "WARNING: msedge.exe process(es) still referencing this run's profile survived cleanup: $REMAINING" >&2
  fi

  rm -f "$PIDFILE"
  # Edge child processes can hold profile files open for a moment even
  # after taskkill returns; retry the cleanup briefly rather than leak
  # the temp dir (harmless if it fails -- it's under $TEMP).
  for i in 1 2 3 4 5; do
    rm -rf "$EDGE_PROFILE" 2>/dev/null && break
    sleep 0.5
  done
}
trap cleanup EXIT

# Ensure the port is actually free before we start. Only kill a PID
# found LISTENING on it if it's genuinely one of our own leftover
# python.exe servers -- never blindly kill whatever is listening there,
# since it could be an unrelated user process.
for p in $(netstat -ano 2>/dev/null | grep ":$PORT " | grep LISTENING | awk '{print $5}' | sort -u); do
  IMAGE=$(tasklist //FI "PID eq $p" //FO CSV 2>/dev/null | tail -n +2 | head -n1 | cut -d',' -f1 | tr -d '"')
  if [ "$IMAGE" = "python.exe" ]; then
    taskkill //F //PID "$p" //T 2>/dev/null || true
  else
    echo "ERROR: port $PORT in use by ${IMAGE:-unknown process} (pid $p); set PORT=... to override" >&2
    exit 1
  fi
done

rm -f "$RESULT_FILE"

# Start server, capturing its real Windows PID via the pidfile.
python tools/serve.py "$PORT" "$PIDFILE" > /dev/null 2>&1 &
disown 2>/dev/null || true

for i in $(seq 1 20); do
  [ -s "$PIDFILE" ] && break
  sleep 0.25
done
SERVER_PID=$(cat "$PIDFILE" 2>/dev/null || true)

if [ -z "$SERVER_PID" ]; then
  echo "ERROR: server did not start (no pidfile written)"
  exit 1
fi

# Launch headless Edge with a unique, freshly-created profile dir so it
# can never attach to a stale/leftover instance.
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  --headless=new --disable-gpu --no-first-run \
  --user-data-dir="$EDGE_PROFILE" \
  "http://127.0.0.1:$PORT/test/?report=1" \
  > /dev/null 2>&1 &
disown 2>/dev/null || true

# Resolve Edge's real Windows PID(s) by matching the unique profile path
# in the command line (works even though $! is an MSYS pid). Collect ALL
# matches (main process plus any renderer/GPU children that inherit the
# same --user-data-dir), not just the first.
for i in $(seq 1 20); do
  EDGE_PIDS=$(resolve_edge_pids)
  [ -n "$EDGE_PIDS" ] && break
  sleep 0.25
done

# Poll for the result file (up to 50 seconds).
for i in $(seq 1 100); do
  if [ -f "$RESULT_FILE" ]; then
    break
  fi
  sleep 0.5
done

# Show result (cleanup runs automatically via the EXIT trap).
if [ -f "$RESULT_FILE" ]; then
  cat "$RESULT_FILE"
  if grep -q "fail 0" "$RESULT_FILE"; then
    exit 0
  else
    exit 1
  fi
else
  echo "ERROR: Test result file not created"
  exit 1
fi
