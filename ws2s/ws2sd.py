import os
import sys
import time
import json
import logging
import logging.config
from multiprocessing import cpu_count

import ws2s
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
    logger.info('ws2s version: ' + ws2s.__version__)
    logger.info('runing on python' + '.'.join(map(str, sys.version_info[0:3])))
    logger.info('location: ' + os.path.dirname(__file__))
    logger.info('listen on %s:%s', ws2s_config.get['listen']['host'], ws2s_config.get['listen']['port'])

    ws2s_server.new_instance(
        ws2s_config.get['listen']['port'],
        ws2s_config.get['listen']['host']
    ).run_forever()


def start():
    server_instance = ws2s_server.new_instance(
        ws2s_config.get['listen']['port'],
        ws2s_config.get['listen']['host']
    )
    pid_list = []
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
                logger.info('stop process at pid: {}'.format(pid))
                os.system('kill {}'.format(pid))
            else:
                logger.info('nothing to stop.')
    with open(pid_path, 'w') as f:
        f.truncate()


def restart():
    stop()
    time.sleep(1)
    start()


def set_start_on_boot():
    os.system('sudo cp ' + os.path.dirname(__file__) + '/resources/ws2sd /etc/init.d/ws2sd '
            + '&& sudo chmod +x /etc/init.d/ws2sd '
            + '&& sudo update-rc.d ws2sd defaults')


def main():
    command = sys.argv[1] if len(sys.argv) > 1 else 'help'
    if command == 'run':
        return run()

    logging.config.fileConfig(os.path.dirname(__file__) + '/resources/logging.conf')
    logger.info('ws2s version: ' + ws2s.__version__)
    logger.info('runing on python' + '.'.join(map(str, sys.version_info[0:3])))
    logger.info('location: ' + os.path.dirname(__file__) + '\n')

    if command == 'start':
        return start()
    if command == 'stop':
        return stop()
    if command == 'restart':
        return restart()
    if command == 'service':
        return set_start_on_boot()

    logger.info('commands:\n'
                + '    ws2sd help:    show this info. alias for "ws2sd" \n'
                + '    ws2sd run:     run ws2s server in front\n'
                + '    ws2sd start:   start ws2s server in background\n'
                + '    ws2sd stop:    stop ws2s server\n'
                + '    ws2sd restart: alias for "stop, sleep(1), start"\n'
                + '    ws2sd service: enable auto-start on boot(test on ubuntu only)\n\n'

                + 'files: (all files are store in ~/.ws2s/)\n'
                + '    config.json: configs. modify it and exec "ws2sd restart"\n'
                + '    ws2s.log:    logs\n'
                + '    pid:         do not modify this file!\n\n'

                + 'more information: https://github.com/playay/ws2s' + '\n'
                )


if __name__ == '__main__':
    main()
