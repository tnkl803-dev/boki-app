#!/bin/bash
# Run async tests via HTTP result callback
# Usage: cd repo && bash tools/run-tests.sh

PORT=8000
RESULT_FILE=".superpowers/test-result.txt"

# Kill any LISTENING process on the port using Windows-safe commands
echo "Cleaning up port $PORT..." >&2
for p in $(netstat -ano 2>/dev/null | grep ":$PORT " | grep LISTENING | awk '{print $5}' | sort -u); do
  taskkill //F //PID "$p" > /dev/null 2>&1 || true
done
sleep 1

# Verify port is free
if netstat -ano 2>/dev/null | grep -q ":$PORT.*LISTENING"; then
  echo "ERROR: Port $PORT still in use" >&2
  exit 1
fi

# Clean up old result
rm -f "$RESULT_FILE"

# Start server (will self-terminate after POST)
python tools/serve.py $PORT > /dev/null 2>&1 &
SERVER_PID=$!

# Wait for server ready
for i in {1..10}; do
  if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/" 2>/dev/null | grep -q 200; then
    break
  fi
  sleep 0.2
done

# Run Edge in background
timeout 60 "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  --headless --disable-gpu --no-first-run \
  --user-data-dir="$TEMP/edge-boki-test" \
  "http://127.0.0.1:$PORT/test/?report=1" \
  > /dev/null 2>&1 &
EDGE_PID=$!

# Poll for result (up to 45 seconds)
for i in {1..90}; do
  if [ -f "$RESULT_FILE" ]; then
    break
  fi
  sleep 0.5
done

# Kill Edge and server
taskkill //F //PID "$EDGE_PID" //T > /dev/null 2>&1 || true
taskkill //F //PID "$SERVER_PID" > /dev/null 2>&1 || true
sleep 1

# Show result and exit
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
