var WS2S = (function () {
    var ws2sServer = "wss://feling.io/ws2s-server/";
    return {
        init: (ws2sServerAddress) => {
            ws2sServer = ws2sServerAddress
            return WS2S
        },
        newSocket: () => {
            var ws = new WebSocket(ws2sServer)
            var ping = setInterval(() => {
                ws.send('{"command":"ping"}')
            }, 50 * 1000)

            var socket = {
                onReady: () => {
                    console.log('socket onReady')
                },
                onOpen: () => {
                    console.log('socket onOpen')
                },
                onRecv: (data) => {
                    console.log('socket onRecv: ', data)
                },
                onClose: (reason) => {
                    console.log('socket onClose: ', reason)
                },
                onError: (error) => {
                    console.log('socket onError: ', error)
                },
                connect: (host, port) => {
                    ws.send(JSON.stringify({
                        command: "connect",
                        host: host,
                        port: port
                    }))
                },
                send: (data) => {
                    ws.send(JSON.stringify({
                        command: "send",
                        data: data
                    }))
                },
                close: () => {
                    ws.send(JSON.stringify({
                        command: "close"
                    }))
                }
            }
            ws.onopen = () => {
                socket.onReady()
            }
            ws.onclose = () => {
                socket.onClose("connection to ws2s server was closed");
                clearInterval(ping)
            }
            ws.onerror = (error) => {
                socket.onError(error)
            }
            ws.onmessage = (event) => {
                var response = JSON.parse(event.data)
                if (response.code < 0) {
                    socket.onRecv(response.data)
                    return
                }
                if (response.code == 0) {
                    if (response.message == 'connect done') {
                        socket.onOpen()
                    }
                    if (response.message == 'close done') {
                        socket.onClose(response.message)
                    }
                    return
                }
                if (response.code == 5) {
                    socket.onClose(response.message)
                    return
                }
                socket.onError(response)
            }
            return socket
        },
        newRedisCient: (host, port, auth) => {
            var socketList = []
            var redisClient = {
                onResponse: (data) => {
                    console.log(data)
                },
                onError: (error) => {
                    console.log('redisClient onError: ', error)
                }
            }

            var initNewSocket = function () {
                var socket = WS2S.newSocket()
                socket.onReady = () => {
                    socket.connect(host, port)
                }
                socket.onOpen = () => {
                    if (auth) {
                        redisClient.request("auth " + auth)
                    }
                }
                socket.onRecv = (data) => {
                    redisClient.onResponse(data)
                }
                socket.onClose = () => {
                    socketList[0] = initNewSocket()
                }
                socket.onError = (error) => {
                    redisClient.onError(error)
                }
                return socket
            }

            socketList[0] = initNewSocket()

            var splitLine = function (line) {
                var wordList = []
                var start = ''
                var word = []
                for (var i = 0; i <= line.length; i++) {
                    var c = line.charAt(i)
                    if (i == line.length && word.length) {
                        wordList.push(word.join(""))
                    }
                    if (c == '"' || c == "'") {
                        if (!start) {
                            start = c
                            continue
                        }
                        if (start == c) {
                            start = ''
                            continue
                        }
                        word.push(c)
                        continue
                    }
                    if (c == ' ') {
                        if (start) {
                            word.push(c)
                        } else if (word.length) {
                            wordList.push(word.join(""))
                            word = []
                        }
                        continue
                    }
                    word.push(c)
                }
                return wordList
            }

            redisClient.request = (humanCommand) => {
                cmd = []
                humanCommand.split(/\r?\n/).forEach((line) => {
                    line = line.trim()
                    if (line.length == 0) {
                        return
                    }
                    wordList = splitLine(line)
                    if (wordList.length == 1) {
                        cmd.push(wordList[0])
                        cmd.push('\r\n')
                    } else {
                        cmd.push('*')
                        cmd.push(wordList.length)
                        cmd.push('\r\n')
                        wordList.forEach((word) => {
                            cmd.push('$')
                            cmd.push(word.length)
                            cmd.push('\r\n')
                            cmd.push(word)
                            cmd.push('\r\n')
                        })
                    }
                })
                socketList[0].send(cmd.join(""))
            }
            return redisClient
        }
    }
} ())