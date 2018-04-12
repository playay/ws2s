import sys
import base64
import logging
logger = logging.getLogger(__name__)

import gevent
from gevent import socket
from gevent import monkey
monkey.patch_all()

from sshtunnel import SSHTunnelForwarder

from ws2s import ws2s_config


_tcp_sockets = {}
_tcp_socket_handlers = {}

_ssh_tunnels = {}

class FailedToOpenSSHTunnel(Exception):
    code = 6
    message = "Failed To Open SSH Tunnel. socketId: {}"

    def __init__(self, socket_id):
        self.message = self.message.format(socket_id)

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


def open_tcp_socket(socket_id, host, port, 
                    ssh_host, ssh_port, ssh_username, 
                    ssh_password, ssh_private_key, ssh_private_key_password):
    if ForbiddenTargetHost.match(host):
        raise ForbiddenTargetHost(host)
    if ssh_host:
        _ssh_tunnels[socket_id] = SSHTunnelForwarder(
                                remote_bind_address=(host, port),
                                ssh_address_or_host=(ssh_host, ssh_port),
                                ssh_username=ssh_username,
                                ssh_password=ssh_password,
                                ssh_pkey=ssh_private_key,
                                ssh_private_key_password=ssh_private_key_password,
                                set_keepalive=30)
        _ssh_tunnels[socket_id].start()
        _tcp_sockets[socket_id] = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        _tcp_sockets[socket_id].connect(('127.0.0.1', _ssh_tunnels[socket_id].local_bind_port))
    else:
        _tcp_sockets[socket_id] = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        _tcp_sockets[socket_id].connect((host, port))


def sendall(socket_id, str_data):
    if socket_id not in _tcp_sockets:
        raise IllegalSocketState(socket_id)
    _tcp_sockets[socket_id].sendall(str_data.encode('utf8'))

def sendallb(socket_id, base64_str_data):
    if socket_id not in _tcp_sockets:
        raise IllegalSocketState(socket_id)
    _tcp_sockets[socket_id].sendall(base64.b64decode(base64_str_data))


def register_handlers(socket_id, recv_handler, close_handler):
    def do_recv():
        while True:
            try:
                if socket_id not in _tcp_sockets:
                    break
                buffer = _tcp_sockets[socket_id].recv(1024 * 32)
                if not buffer:
                    close_handler(5, 'connection closed by peer')
                    break
                if sys.version_info > (3, 0):
                    recv_handler(base64.b64encode(buffer).decode('utf8'))
                else:
                    recv_handler(base64.b64encode(buffer))
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
    tunnel = _ssh_tunnels.pop(socket_id, None)
    if tunnel:
        tunnel.stop()
