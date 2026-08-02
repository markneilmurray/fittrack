import http.server
import functools
import os

DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=DIR)
server = http.server.ThreadingHTTPServer(("0.0.0.0", 8420), handler)
server.serve_forever()
