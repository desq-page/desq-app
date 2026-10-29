# A simple way to start index.html locally
# Need to install Python / Python Launcher on Mac or Windows, then double click and run the script

import webbrowser
import socket
sock = socket.socket()
sock.bind(('', 0))
port=sock.getsockname()[1]

try:
    # Python 2
    from SimpleHTTPServer import HTTPServer, SimpleHTTPRequestHandler
except ImportError:
    # Python 3
    from http.server import  HTTPServer, SimpleHTTPRequestHandler
webbrowser.open('http://localhost:' + str(port) + '/index.html')

httpd = HTTPServer(('127.0.0.1', port), SimpleHTTPRequestHandler)
httpd.serve_forever()
