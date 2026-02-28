#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
PIDFILE="$DIR/.doraemon.pid"

stop_all() {
  if [ ! -f "$PIDFILE" ]; then
    echo "No running instance found."
    exit 1
  fi
  BACKEND_PID=$(sed -n '1p' "$PIDFILE")
  FRONTEND_PID=$(sed -n '2p' "$PIDFILE")
  echo "Stopping backend (PID $BACKEND_PID) and frontend (PID $FRONTEND_PID)..."
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  wait $BACKEND_PID 2>/dev/null
  wait $FRONTEND_PID 2>/dev/null
  rm -f "$PIDFILE"
  echo "Done."
  exit 0
}

if [ "$1" = "stop" ]; then
  stop_all
fi

# Check .env
if [ ! -f "$DIR/backend/.env" ]; then
  echo "No backend/.env found. Copying from .env.example..."
  cp "$DIR/backend/.env.example" "$DIR/backend/.env"
  echo "Edit backend/.env to add your MISTRAL_API_KEY"
fi

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  wait $BACKEND_PID 2>/dev/null
  wait $FRONTEND_PID 2>/dev/null
  rm -f "$PIDFILE"
  echo "Done."
  exit 0
}
trap cleanup SIGINT SIGTERM

# Start backend
echo "Starting backend on :8000..."
cd "$DIR/backend" && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Start frontend
echo "Starting frontend (Electron)..."
cd "$DIR/frontend" && npm run dev &
FRONTEND_PID=$!

# Save PIDs for stop command
echo "$BACKEND_PID" > "$PIDFILE"
echo "$FRONTEND_PID" >> "$PIDFILE"

echo ""
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C or run './start.sh stop' to stop both."
echo ""

wait
