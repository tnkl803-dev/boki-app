#!/bin/bash
# Run async tests via HTTP result callback
# Usage: cd repo && bash tools/run-tests.sh

PORT=8000
RESULT_FILE=".superpowers/test-result.txt"

# Kill any existing processes
taskkill /IM python.exe /F 2>/dev/null | grep -q serve || true
taskkill /IM msedge.exe /F 2>/dev/null | grep -q SUCCESS || true
sleep 1

# Verify port is free
if netstat -ano 2>/dev/null | grep -q ":$PORT.*LISTENING"; then
  for p in $(netstat -ano 2>/dev/null | grep ":$PORT " | grep LISTENING | awk '{print $5}' | sort -u); do
    taskkill /F /PID "$p" /T 2>/dev/null || true
  done
  sleep 1
fi

# Clean up old result
rm -f "$RESULT_FILE"

# Start server
python tools/serve.py $PORT > /dev/null 2>&1 &
SERVER_PID=$!
sleep 1

# Run Edge in background
timeout 60 "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  --headless --disable-gpu --no-first-run \
  --user-data-dir="$TEMP/edge-boki-test" \
  "http://127.0.0.1:$PORT/test/?report=1" \
  > /dev/null 2>&1 &
EDGE_PID=$!

# Poll for result (up to 50 seconds)
for i in {1..100}; do
  if [ -f "$RESULT_FILE" ]; then
    break
  fi
  sleep 0.5
done

# Aggressive cleanup
sleep 1
taskkill /IM msedge.exe /F 2>/dev/null || true
taskkill /F /PID "$SERVER_PID" 2>/dev/null || true
sleep 1

# Show result
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
