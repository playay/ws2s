class WS2S {
    constructor(ws2sServerAddress) {
        this.ws2sServerAddress = ws2sServerAddress
    }

    newSocket() {
        var ws = new WebSocket(this.ws2sServerAddress)
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
            onClose: () => {
                console.log('socket onClose')
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
            socket.onClose()
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
                    ws.close()
                }
                return
            }
            if (response.code == 5 || response.code == 3) {
                ws.close()
                return
            }
            socket.onError(response)
        }
        return socket
    }

    newRedisCient(host, port, auth) {
        var utf8Encoder = new TextEncoder('utf-8')
        var utf8Decoder = new TextDecoder('utf-8')
        var socketList = []
        var redisClient = {
            onReady: () => {
                console.log('redisClient onReady')
            },
            onResponse: (data) => {
                console.log(data)
            },
            onError: (error) => {
                console.log('redisClient onError: ', error)
            }
        }

        // parse redis response data
        var parse = function (data, restOfData) {
            if (restOfData === undefined) {
                restOfData = []
            }
            if (data.charAt(0) === '$') {
                var stringByteLength = parseInt(data.substring(1, data.indexOf('\r\n')))
                if (stringByteLength === -1) {
                    restOfData[0] = data.substring(data.indexOf('\r\n') + 2)
                    return null
                }
                var nextLine = data.substring(data.indexOf('\r\n') + 2)
                restOfData[0] = utf8Decoder.decode(
                    utf8Encoder.encode(nextLine).slice(stringByteLength + 2)
                )
                return utf8Decoder.decode(
                    utf8Encoder.encode(nextLine).slice(0, stringByteLength)
                )
            }
            if (data.charAt(0) === '+') {
                restOfData[0] = data.substring(data.indexOf('\r\n') + 2)
                return data.substring(1, data.indexOf('\r\n'))
            }
            if (data.charAt(0) === ':') {
                restOfData[0] = data.substring(data.indexOf('\r\n') + 2)
                return parseInt(data.substring(1, data.indexOf('\r\n')))
            }
            if (data.charAt(0) === '*') {
                var arraySize = parseInt(data.substring(1, data.indexOf('\r\n')))
                if (arraySize === -1) {
                    restOfData[0] = data.substring(data.indexOf('\r\n') + 2)
                    return null
                }
                var array = []
                if (arraySize === 0) {
                    restOfData[0] = data.substring(data.indexOf('\r\n') + 2)
                    return array
                }
                data = data.substring(data.indexOf('\r\n') + 2)
                for (let i = 0; i < arraySize; i++) {
                    restOfData = []
                    array.push(parse(data, restOfData))
                    data = restOfData[0]
                }
                return array
            }
            if (data.charAt(0) === '-') {
                redisClient.onError(data)
                restOfData[0] = data.substring(data.indexOf('\r\n') + 2)
                return undefined
            }
            return data
        }

        var initNewSocket = function (thisInstance) {
            var socket = thisInstance.newSocket()
            socket.onReady = () => {
                socket.connect(host, port)
            }
            socket.onOpen = () => {
                if (auth) {
                    redisClient.request("auth " + auth)
                }
                redisClient.onReady()
            }
            socket.onRecv = (data) => {
                var parsedData = parse(data)
                if (parsedData !== undefined) {
                    redisClient.onResponse(parsedData)
                }
            }
            socket.onClose = () => {
                socketList[0] = initNewSocket(thisInstance)
            }
            socket.onError = (error) => {
                socketList[0].close()
                redisClient.onError(error)
            }
            return socket
        }

        socketList[0] = initNewSocket(this)

        // split one line command to wordList
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
            var cmd = []
            humanCommand.split(/\r?\n/).forEach((line) => {
                line = line.trim()
                if (line.length == 0) {
                    return
                }
                var wordList = splitLine(line)
                if (wordList.length == 1) {
                    cmd.push(wordList[0])
                    cmd.push('\r\n')
                } else {
                    cmd.push('*')
                    cmd.push(wordList.length)
                    cmd.push('\r\n')
                    wordList.forEach((word) => {
                        cmd.push('$')
                        cmd.push(utf8Encoder.encode(word).length)
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