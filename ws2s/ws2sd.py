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
import time
import json
import logging
import logging.config
import platform

from ws2s import ws2s_server
from ws2s import ws2s_config


logger = logging.getLogger('ws2sd')

base_path = os.path.expanduser('~') + '/.ws2s/'
pid_path = base_path + 'pid'
config_path = base_path + 'config.json'

# init dir
if not os.path.exists(base_path):
    os.makedirs(base_path)

# init config_file
if not os.path.exists(config_path):
    with open(config_path, 'w') as f:
        f.write(json.dumps(
            {
                'listen': {
                    'host': '127.0.0.1',
                    'port': 3613
                },
                'allowConnectToServerLocal': False
            }, sort_keys=True, indent=4, separators=(',', ': ')
        ))

# init config
with open(config_path) as config_file:
    ws2s_config.get = json.load(config_file)


def run():
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s %(levelname)s %(threadName)s %(filename)s:%(lineno)d %(message)s'
    )
    logger.info('listen on %s:%s',
                ws2s_config.get['listen']['host'],
                ws2s_config.get['listen']['port']
                )
    ws2s_server.new_instance(
        ws2s_config.get['listen']['port'],
        ws2s_config.get['listen']['host']
    ).run_forever()


def start():
    logging.config.fileConfig(os.path.dirname(__file__) + '/logging.conf')

    server_instance = ws2s_server.new_instance(
        ws2s_config.get['listen']['port'],
        ws2s_config.get['listen']['host']
    )
    pid_list = []
    if platform.system() == 'Windows':
        import subprocess
        import shlex
        cmd_args = shlex.split("python -m ws2s.ws2sd run")
        popen = subprocess.Popen(cmd_args)
        pid_list.append(str(popen.pid))
    else:
        from multiprocessing import cpu_count
        for i in range(cpu_count()):
            pid = os.fork()
            if pid == 0:
                del pid_list
                server_instance.run_forever()
            else:
                pid_list.append(str(pid))
    logger.info('start process{} at pid: {}'.format(
        'es' if len(pid_list) > 1 else '', '|'.join(pid_list)))
    with open(pid_path, 'w') as f:
        f.write('|'.join(pid_list))


def stop():
    if not os.path.exists(pid_path):
        logger.warn('{} not exists'.format(pid_path))
        return
    with open(pid_path, 'r') as f:
        pid_list = f.readline().split('|')
        for pid in pid_list:
            if pid:
                os.system('kill {}'.format(pid))
                logger.info('stop process at pid: {}'.format(pid))
            else:
                logger.info('nothing to stop.')
    with open(pid_path, 'w') as f:
        f.truncate()


def restart():
    stop()
    time.sleep(1)
    start()


def main():
    command = sys.argv[1] if len(sys.argv) > 1 else 'help'
    if command == 'run':
        return run()
    if command == 'start':
        return start()
    if command == 'stop':
        return stop()
    if command == 'restart':
        return restart()

    logger.info('commands:\n'
                + '    ws2sd help:    show this info. alias for "ws2sd" \n'
                  + '    ws2sd run:     run ws2s server in front\n'
                  + '    ws2sd start:   start ws2s server in background\n'
                  + '    ws2sd stop:    stop ws2s server\n'
                  + '    ws2sd restart: alias for "stop, sleep(1), start"\n\n'

                  + 'files: (all files are store in ~/.ws2s/)\n'
                  + '    config.json: configs. modify it and exec "ws2sd restart"\n'
                  + '    ws2s.log:    logs\n'
                  + '    pid:         do not modify this file!\n\n'

                + 'more information: https://github.com/playlay/ws2s'
                  + '\n\n'
                )


if __name__ == '__main__':
    main()
