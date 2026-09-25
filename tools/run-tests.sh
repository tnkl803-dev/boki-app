#!/bin/bash
# Run async tests via HTTP result callback
# Usage: cd repo && bash tools/run-tests.sh

PORT=8000
RESULT_FILE=".superpowers/test-result.txt"

# Clean up old server/result
ps aux | grep -E "serve.py|http.server" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || true
sleep 1
rm -f "$RESULT_FILE"

# Start server
python tools/serve.py $PORT > /dev/null 2>&1 &
SERVER_PID=$!
sleep 2

# Wait for server ready
for i in {1..10}; do
  if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/" 2>/dev/null | grep -q 200; then
    break
  fi
  sleep 0.5
done

# Run Edge
timeout 60 "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  --headless --disable-gpu --no-first-run \
  --user-data-dir="$TEMP/edge-boki-test" \
  "http://127.0.0.1:$PORT/test/?report=1" \
  > /dev/null 2>&1 || true

# Poll for result
for i in {1..120}; do
  if [ -f "$RESULT_FILE" ]; then
    break
  fi
  sleep 0.5
done

# Show result and exit
if [ -f "$RESULT_FILE" ]; then
  cat "$RESULT_FILE"
  if grep -q "fail [^0]" "$RESULT_FILE"; then
    kill $SERVER_PID 2>/dev/null || true
    exit 1
  fi
else
  echo "ERROR: Test result file not created"
  kill $SERVER_PID 2>/dev/null || true
  exit 1
fi

kill $SERVER_PID 2>/dev/null || true
