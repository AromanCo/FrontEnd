"""Run the pinned FastAPI app with a private, local FakeSMS inspection socket."""

import json
import os
import socketserver
import sys
import threading

import uvicorn

from aroman.authentication.sms import FakeSMS, get_sms_provider
from aroman.main import app


class OTPHandler(socketserver.StreamRequestHandler):
    def handle(self):
        mobile = self.rfile.readline(128).decode("ascii").strip()
        provider = get_sms_provider()
        if not isinstance(provider, FakeSMS):
            self.wfile.write(b"{}\n")
            return
        code = next((code for recipient, code in reversed(provider.messages) if recipient == mobile), None)
        self.wfile.write((json.dumps({"code": code}) + "\n").encode())


class PrivateSocket(socketserver.ThreadingUnixStreamServer):
    daemon_threads = True


def main():
    socket_path = os.environ["AROMAN_TEST_OTP_SOCKET"]
    with PrivateSocket(socket_path, OTPHandler) as ipc:
        os.chmod(socket_path, 0o600)
        threading.Thread(target=ipc.serve_forever, daemon=True).start()
        try:
            uvicorn.run(app, host="127.0.0.1", port=int(os.environ["AROMAN_TEST_API_PORT"]), log_level="warning")
        finally:
            ipc.shutdown()
    os.unlink(socket_path)


if __name__ == "__main__":
    main()
