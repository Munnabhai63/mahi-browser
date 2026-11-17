import http.server
import socketserver
import os
import functools

PORT = 5000
DIRECTORY = r"F:\My Web Sites\Lateral_Complete_Theme"
os.chdir(DIRECTORY)

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        pass

class RobustTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == "__main__":
    with RobustTCPServer(("", PORT), Handler) as httpd:
        print(f"Exact Theme Server running at http://localhost:{PORT}")
        httpd.serve_forever()
