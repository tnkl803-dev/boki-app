#!/usr/bin/env python3
import sys
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

class ResultHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Suppress request logging

    def do_POST(self):
        if self.path == '/__result':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')

            # Create .superpowers directory if needed
            result_dir = Path(__file__).parent.parent / '.superpowers'
            result_dir.mkdir(exist_ok=True)

            # Write result file
            result_file = result_dir / 'test-result.txt'
            result_file.write_text(body, encoding='utf-8')

            # Reply with 204 No Content
            self.send_response(204)
            self.end_headers()
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
    print(f'Serving on http://127.0.0.1:{port}/', file=sys.stderr)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
