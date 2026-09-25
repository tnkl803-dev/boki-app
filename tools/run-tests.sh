#!/bin/bash
# Run async tests via HTTP result callback.
# Usage: cd repo && bash tools/run-tests.sh
#
# Design notes (see .superpowers/sdd/2026-09-25-boki-app-v1/task-3-report.md,
# "Harness fix round 2"):
# - Never taskkill by /IM (image name) -- that kills the user's real
#   Edge/Python processes too. Only ever kill by exact Windows PID.
# - git-bash mangles /F /IM /PID as path globs; use the // form instead
#   (taskkill //F //PID <pid> //T).
# - $! from bash is an MSYS pid, not the Windows PID. serve.py writes its
#   real os.getpid() to a pidfile we pass in; Edge's real Windows PID is
#   found via a unique --user-data-dir token and PowerShell CIM lookup.
# - Each run uses a fresh, unique --user-data-dir so a leftover headless
#   Edge profile lock can never cause the new instance to hand off the
#   URL to an old (possibly already-dead) instance and exit immediately.
# - serve.py also self-terminates via a watchdog timer if it never
#   receives a POST, so it can't become a permanent zombie listener.

set -u

PORT=8765
RESULT_FILE=".superpowers/test-result.txt"
RUN_ID="bokitest-$$-$RANDOM"
PIDFILE=$(mktemp)
EDGE_PROFILE=$(mktemp -d)
SERVER_PID=""
EDGE_PID=""

cleanup() {
  if [ -n "${SERVER_PID:-}" ]; then
    taskkill //F //PID "$SERVER_PID" //T >/dev/null 2>&1 || true
  fi
  if [ -n "${EDGE_PID:-}" ]; then
    taskkill //F //PID "$EDGE_PID" //T >/dev/null 2>&1 || true
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

# Ensure the port is actually free before we start (kill only PIDs that
# hold this exact port, never by image name).
for p in $(netstat -ano 2>/dev/null | grep ":$PORT " | grep LISTENING | awk '{print $5}' | sort -u); do
  taskkill //F //PID "$p" //T 2>/dev/null || true
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

# Resolve Edge's real Windows PID by matching the unique profile path in
# its command line (works even though $! is an MSYS pid).
EDGE_PROFILE_WIN=$(cygpath -w "$EDGE_PROFILE" 2>/dev/null || echo "$EDGE_PROFILE")
EDGE_PROFILE_ESCAPED=$(printf '%s' "$EDGE_PROFILE_WIN" | sed "s/'/''/g")
for i in $(seq 1 20); do
  EDGE_PID=$(powershell.exe -NoProfile -Command \
    "(Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { \$_.CommandLine -like '*${EDGE_PROFILE_ESCAPED}*' } | Select-Object -First 1 -ExpandProperty ProcessId)" \
    2>/dev/null | tr -d '\r\n ')
  [ -n "$EDGE_PID" ] && break
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
