#!/bin/bash
set -e

REPO="$(cd "$(dirname "$0")/.." && pwd)"
RESULT_FILE="$REPO/.superpowers/test-result.txt"
PORT=8000

# Kill any previous server on the port
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
  kill $(lsof -ti :$PORT) 2>/dev/null || true
  sleep 1
fi

# Start the serve.py server
python "$REPO/tools/serve.py" $PORT > /dev/null 2>&1 &
SERVER_PID=$!
sleep 1

# Wait for server to be ready
for i in {1..10}; do
  if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/" | grep -q 200; then
    break
  fi
  sleep 0.5
done

# Clean up old result file
rm -f "$RESULT_FILE"

# Run headless Edge (--headless without =new for better time handling)
timeout 40 "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  --headless --disable-gpu --no-first-run \
  --user-data-dir="$TEMP/edge-boki-test" \
  "http://127.0.0.1:$PORT/test/?report=1" \
  2>/dev/null || true

# Poll for result file (up to 40 seconds)
for i in {1..80}; do
  if [ -f "$RESULT_FILE" ]; then
    break
  fi
  sleep 0.5
done

# Display result
if [ -f "$RESULT_FILE" ]; then
  cat "$RESULT_FILE"
  # Exit with failure if there are any failures
  if grep -q "fail [^0]" "$RESULT_FILE"; then
    exit 1
  fi
else
  echo "ERROR: Test result file not created"
  exit 1
fi
