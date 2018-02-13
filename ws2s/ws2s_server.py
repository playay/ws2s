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

import os
import sys
import json
import logging
logger = logging.getLogger(__name__)

from ws2s.tcp_sockets import *
from ws2s.websocket_server import WebsocketServer


def controller_advice(message_received):
    def message_received_wrapper(client, server, message):
        try:
            logger.debug("received from client: {}, message: {}.".format(
                client['address'], message))
            response_message = message_received(client, server, message)
        except (IllegalSocketState, ForbiddenTargetHost) as e:
            response_message = json.dumps({
                'success': False,
                'code': e.code,
                'message': e.message
            })
        except ConnectionRefusedError:
            response_message = json.dumps({
                'success': False,
                'code': 2,
                'message': "connection refused"
            })
        except Exception as e:
            logger.exception("unknown exception")
            response_message = json.dumps({
                'success': False,
                'code': 1,
                'message': repr(e)
            })
        finally:
            if response_message:
                server.send_message(client, response_message)
                logger.debug("send to client: {}, message: {}.".format(
                    client['address'], response_message))
        return
    return message_received_wrapper


@controller_advice
def message_received(client, server, message):
    msg = json.loads(message)
    
    if msg['command'] == 'connect':
        unregister_handlers_if_exists(client['id'])
        close_tcp_socket_if_exists(client['id'])
        open_tcp_socket(client['id'], msg['host'], msg['port'])
        _register_handlers(client, server)

    if msg['command'] == 'send':
        sendall(client['id'], msg['data'])

    if msg['command'] == 'close':
        unregister_handlers_if_exists(client['id'])
        close_tcp_socket_if_exists(client['id'])
    
    return json.dumps({
        'success': True,
        'code': 0,
        'message': msg['command'] + 'done'
    })


def _register_handlers(client, server):
    def recv_handler(data):
        message = json.dumps({
            'success': True,
            'code': -1,
            'message': 'recv data',
            'data': data
        })
        server.send_message(client, message)
        logger.debug("send to client: {}, message: {}.".format(
            client['address'], message))

    def close_handler(reason):
        message = json.dumps({
            'success': False,
            'code': IllegalSocketState.code,
            'message': reason
        })
        server.send_message(client, message)
        logger.debug("send to client: {}, message: {}.".format(
            client['address'], message))

    register_handlers(client['id'], recv_handler, close_handler)


def new_client(client, server):
    logger.debug("new client: {} connected.".format(client['address']))


def client_left(client, server):
    logger.debug("client: {} disconnected.".format(client['address']))
    unregister_handlers_if_exists(client['id'])
    close_tcp_socket_if_exists(client['id'])


def new_instance(port, host):
    server = WebsocketServer(port, host)
    server.set_fn_message_received(message_received)
    server.set_fn_client_left(client_left)
    server.set_fn_new_client(new_client)
    return server
