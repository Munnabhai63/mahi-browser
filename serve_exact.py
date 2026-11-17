import http.server
import socketserver
import os
import functools

PORT = 3000
DIRECTORY = r"F:\My Web Sites\Lateral_Complete_Theme"
os.chdir(DIRECTORY)

Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=DIRECTORY)

class RobustTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == "__main__":
    with RobustTCPServer(("", PORT), Handler) as httpd:
        print(f"Serving {DIRECTORY} on port {PORT}")
        httpd.serve_forever()
