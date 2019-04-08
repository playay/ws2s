import os
import sys
import json
import logging
logger = logging.getLogger(__name__)

from ws2s.tcp_sockets import *
from ws2s.websocket_server import WebsocketServer


def controller_advice(message_received):
    def message_received_wrapper(client, server, message):
        response_message = None
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
        open_tcp_socket(client['id'], msg['host'], msg['port'],
            ssh_host = msg.get('ssh_host', None), 
            ssh_port = msg.get('ssh_port', 22), 
            ssh_username = msg.get('ssh_username', None), 
            ssh_password = msg.get('ssh_password', None), 
            ssh_private_key = msg.get('ssh_private_key', None), 
            ssh_private_key_password = msg.get('ssh_private_key_password', None)
        )
        _register_handlers(client, server)

    if msg['command'] == 'send':
        sendall(client['id'], msg['data'])

    if msg['command'] == 'sendb':
        sendallb(client['id'], msg['data'])

    if msg['command'] == 'close':
        unregister_handlers_if_exists(client['id'])
        close_tcp_socket_if_exists(client['id'])

    return json.dumps({
        'success': True,
        'code': 0,
        'message': msg['command'] + ' done'
    })


def _register_handlers(client, server):
    def recv_handler(data):
        response_message = json.dumps({
            'success': True,
            'code': -1,
            'message': 'recv data',
            'data': data
        })
        server.send_message(client, response_message)
        logger.debug("send to client: {}, message: {}.".format(
            client['address'], response_message))

    def close_handler(code, message):
        response_message = json.dumps({
            'success': False,
            'code': code,
            'message': message
        })
        server.send_message(client, response_message)
        logger.debug("send to client: {}, message: {}.".format(
            client['address'], response_message))

    register_handlers(client['id'], recv_handler, close_handler)


def new_client(client, server):
    if client:
        logger.debug("new client: {} connected.".format(client['address']))


def client_left(client, server):
    if client:
        logger.debug("client: {} disconnected.".format(client['address']))
        unregister_handlers_if_exists(client['id'])
        close_tcp_socket_if_exists(client['id'])


def new_instance(port, host):
    server = WebsocketServer(port, host)
    server.set_fn_message_received(message_received)
    server.set_fn_client_left(client_left)
    server.set_fn_new_client(new_client)
    return server
