#!/usr/bin/env python3
import sys
import os
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

class ResultHandler(SimpleHTTPRequestHandler):
    server_instance = None

    def log_message(self, format, *args):
        # Log to stderr for debugging
        import sys
        print(f"[LOG] {format % args}", file=sys.stderr)

    def do_POST(self):
        if self.path == '/__result':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')

            # Create .superpowers directory if needed
            result_dir = Path(__file__).parent.parent / '.superpowers'
            result_dir.mkdir(exist_ok=True)

            # Write result file
            result_file = result_dir / 'test-result.txt'
            with open(result_file, 'w', encoding='utf-8') as f:
                f.write(body)
                f.flush()
                os.fsync(f.fileno())

            # Reply with 204 No Content
            self.send_response(204)
            self.end_headers()
            self.wfile.flush()

            # Shut down server after sending result (prevent zombie process)
            if self.server_instance:
                def delayed_shutdown():
                    time.sleep(0.5)  # Ensure response is sent before shutdown
                    self.server_instance.shutdown()
                threading.Thread(target=delayed_shutdown, daemon=True).start()
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        if self.path == '/':
            self.path = '/test/'
        return super().do_GET()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    # Change to repo root
    os.chdir(Path(__file__).parent.parent)

    server = ThreadingHTTPServer(('127.0.0.1', port), ResultHandler)
    ResultHandler.server_instance = server
    print(f'Serving on http://127.0.0.1:{port}/', file=sys.stderr)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
