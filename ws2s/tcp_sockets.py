# Author: chenyan
# Email:chenyan@feling.net
# License: MIT
# The MIT License (MIT)

# Copyright (c) 2018 chenyan

# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:

# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.

# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

import sys
import logging
logger = logging.getLogger(__name__)

import gevent
from gevent import socket
from gevent import monkey
monkey.patch_all()

from ws2s import ws2s_config


_tcp_sockets = {}
_tcp_socket_handlers = {}


class IllegalSocketState(Exception):
    code = 3
    message = "illegal socket status, please connect again. socketId: {}"

    def __init__(self, socket_id):
        self.message = self.message.format(socket_id)


class ForbiddenTargetHost(Exception):
    code = 4
    message = "ws2s refuse to connect target host: {}, cause that's a dangerous operation"

    def __init__(self, target_host):
        self.message = self.message.format(target_host)

    @staticmethod
    def match(host):
        if not ws2s_config.get['allowConnectToServerLocal'] \
                and socket.gethostbyname(host) == '127.0.0.1':
            return True
        return False


def open_tcp_socket(socket_id, host, port):
    if ForbiddenTargetHost.match(host):
        raise ForbiddenTargetHost(host)
    _tcp_sockets[socket_id] = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    _tcp_sockets[socket_id].connect((host, port))


def sendall(socket_id, data):
    if socket_id not in _tcp_sockets:
        raise IllegalSocketState(socket_id)
    _tcp_sockets[socket_id].sendall(data.encode('utf8'))


def register_handlers(socket_id, recv_handler, close_handler):
    def do_recv():
        while True:
            try:
                if socket_id not in _tcp_sockets:
                    break
                buffer = _tcp_sockets[socket_id].recv(1024)
                if not buffer:
                    close_handler(5, 'connection closed by peer')
                    break
                if sys.version_info < (3, 0):
                    recv_handler(list(bytearray(buffer)))
                else:
                    recv_handler(list(buffer))
            except Exception as e:
                logging.exception('do_recv failed.')
                close_handler(1, repr(e))
                break
        close_tcp_socket_if_exists(socket_id)
        unregister_handlers_if_exists(socket_id)

    _tcp_socket_handlers[socket_id] = gevent.spawn(do_recv)


def unregister_handlers_if_exists(socket_id):
    handlers = _tcp_socket_handlers.pop(socket_id, None)
    if handlers:
        handlers.kill()


def close_tcp_socket_if_exists(socket_id):
    tcp = _tcp_sockets.pop(socket_id, None)
    if tcp:
        tcp.close()
