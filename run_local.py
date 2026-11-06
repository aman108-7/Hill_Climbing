#!/usr/bin/env python3
"""Launch Hill Climbing Lab locally using Python's standard library."""
import argparse
import errno
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import threading
import webbrowser


class StaticHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def port_number(value):
    try:
        port = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError('Port must be a number.') from exc
    if not 0 <= port <= 65535:
        raise argparse.ArgumentTypeError('Port must be between 0 and 65535.')
    return port


def main():
    if sys.version_info < (3, 8):
        print('Please install Python 3.8 or newer to run Hill Climbing Lab.')
        return 1

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=port_number, default=8080,
                        help='Local port (default: 8080; 0 chooses a free port).')
    parser.add_argument('--no-browser', action='store_true',
                        help='Start the server without opening a browser.')
    args = parser.parse_args()
    folder = Path(__file__).resolve().parent / 'dist'
    if not (folder / 'index.html').is_file():
        print('Application files are missing. Extract the entire ZIP before starting.')
        return 1

    handler = partial(StaticHandler, directory=str(folder))
    try:
        try:
            server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
        except OSError as exc:
            if exc.errno != errno.EADDRINUSE and getattr(exc, 'winerror', None) != 10048:
                raise
            print('Port {} is busy; choosing another free local port.'.format(args.port), flush=True)
            server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    except OSError as exc:
        print('Could not start the local server: {}'.format(exc))
        return 1

    url = 'http://127.0.0.1:{}/'.format(server.server_address[1])
    print('\nHill Climbing Lab is ready.\n', flush=True)
    print(url, flush=True)
    print('\nKeep this window open while using the visualizer.')
    print('Press Ctrl+C to stop the server.\n', flush=True)
    browser_timer = None
    if not args.no_browser:
        browser_timer = threading.Timer(0.5, webbrowser.open, args=(url,))
        browser_timer.daemon = True
        browser_timer.start()
    try:
        with server:
            server.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        print('\nServer stopped.')
    finally:
        if browser_timer is not None:
            browser_timer.cancel()
    return 0


if __name__ == '__main__':
    sys.exit(main())
