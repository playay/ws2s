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
        var receiving = false
        var toReceive = []
        ws.onmessage = (event) => {
            var response = JSON.parse(event.data)
            if (response.code < 0) {
                toReceive.push(response.data)
                if (!receiving) {
                    receiving = true
                    while (toReceive.length > 0) {
                        socket.onRecv(toReceive.shift())
                    }
                    receiving = false
                }
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
        class ResponseHandler {
            constructor(oldStatus) {
                this.init(oldStatus)
            }

            init(oldStatus){
                if (oldStatus) {
                    this.status = oldStatus
                    return
                }
                this.status = {
                    rootType: '',
                    shiftOne: false,

                    arraySizeByteList: [],
                    arraySize: -2,
                    arrayIndex: 0,
                    childrenStatus: null,

                    stringLengthByteList: [],
                    stringLength: -2,
                    stringIndex: 0,

                    complete: false,
                    isNullResult: false,
                    resultByteList: [],
                }
            }

            push(byteList) {
                if (this.status.shiftOne) {
                    byteList.shift()
                    this.status.shiftOne = false
                }
                if (this.status.complete) {
                    this.init()
                }
                while (this.status.rootType !== '+' 
                        && this.status.rootType !== '-'
                        && this.status.rootType !== ':'
                        && this.status.rootType !== '$'
                        && this.status.rootType !== '*') {
                    let x = byteList.shift()
                    if (x === undefined || byteList.length === 0) {
                        return this.status
                    }
                    this.status.rootType = String.fromCharCode(x)
                }

                if (this.status.rootType === '+' 
                    || this.status.rootType === '-' 
                    || this.status.rootType === ':') {
                    var stopByte = '\r'.charCodeAt(0)
                    var b = byteList.shift()
                    while (b !== stopByte && b !== undefined) {
                        this.status.resultByteList.push(b)
                        b = byteList.shift()
                    }
                    if (b == stopByte) {
                        if (byteList.length > 0) {
                            byteList.shift()
                        } else {
                            this.status.shiftOne = true
                        }
                        this.status.complete = true
                    }
                }
                if (this.status.rootType === '$') {
                    if (this.status.stringLength === -2) {// get length
                        var stopByte = '\r'.charCodeAt(0)
                        var b = byteList.shift()
                        while (b !== stopByte && b !== undefined) {
                            this.status.stringLengthByteList.push(b)
                            b = byteList.shift()
                        }
                        if (b == stopByte) {
                            if (byteList.length > 0) {
                                byteList.shift()
                            } else {
                                this.status.shiftOne = true
                            }
                            this.status.stringLength = parseInt(utf8Decoder.decode(new Uint8Array(this.status.stringLengthByteList)))
                        }
                    }
                    if (this.status.stringLength === -1) {
                        this.status.complete = true
                        this.status.isNullResult = true
                    }
                    if (this.status.stringLength > -1) {
                        var b = byteList.shift()
                        while (this.status.stringIndex < this.status.stringLength && b !== undefined) {
                            this.status.resultByteList.push(b)
                            b = byteList.shift()
                            this.status.stringIndex  = this.status.stringIndex  + 1
                        }
                        if (this.status.stringIndex === this.status.stringLength) {
                            if (byteList.length > 0) {
                                byteList.shift()
                            } else {
                                this.status.shiftOne = true
                            }
                            this.status.complete = true
                        }
                    }
                }
                if (this.status.rootType === '*') {
                    if (this.status.arraySize === -2) {// get length
                        var stopByte = '\r'.charCodeAt(0)
                        var b = byteList.shift()
                        while (b !== stopByte && b !== undefined) {
                            this.status.arraySizeByteList.push(b)
                            b = byteList.shift()
                        }
                        if (b == stopByte) {
                            if (byteList.length > 0) {
                                byteList.shift()
                            } else {
                                this.status.shiftOne = true
                            }
                            this.status.arraySize = parseInt(utf8Decoder.decode(new Uint8Array(this.status.arraySizeByteList)))
                        }
                    }
                    if (this.status.arraySize === -1) {
                        this.status.complete = true
                        this.status.isNullResult = true
                    }
                    if (this.status.arraySize > -1) {
                        while(this.status.arrayIndex < this.status.arraySize && byteList.length > 0) {
                            var itemHandler = new ResponseHandler(this.status.childrenStatus)
                            var itemStatus = itemHandler.push(byteList)
                            while (!itemStatus.complete && byteList.length > 0) {
                                itemStatus = itemHandler.push(byteList)
                            }
                            if (itemStatus.complete) {
                                var prefixIndex = (this.status.arrayIndex + 1) + ') '
                                for (let i = 0; i < prefixIndex.length; i++) {
                                    this.status.resultByteList.push(prefixIndex.charCodeAt(i))
                                }
                                for (let i = 0; i < itemStatus.resultByteList.length; i++) {
                                    this.status.resultByteList.push(itemStatus.resultByteList[i])
                                }
                                if (this.status.arrayIndex < this.status.arraySize - 1) {
                                    this.status.resultByteList.push('\n'.charCodeAt(0))
                                }
                                this.status.arrayIndex = this.status.arrayIndex + 1
                            }
                            if (!itemStatus.complete) {
                                this.status.childrenStatus = itemStatus
                            }
                        }
                        if (this.status.arrayIndex === this.status.arraySize) {
                            this.status.complete = true
                        }
                    }
                }
                return this.status
            }
        }
        var responseHandler = new ResponseHandler()
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
                var status = responseHandler.push(data)
                if (status.complete) {
                    if (status.isNullResult) {
                        redisClient.onError("a null object is recevied form redis server")
                        return
                    }
                    var parsedString = utf8Decoder.decode(new Uint8Array(status.resultByteList))
                    if (status.rootType === '+' || status.rootType === '$' || status.rootType === '*') {
                        redisClient.onResponse(parsedString)
                    }
                    if (status.rootType === '-') {
                        redisClient.onError(parsedString)
                    }
                    if (status.rootType === ':') {
                        redisClient.onResponse(parseInt(parsedString))
                    }
                }
            }
            socket.onClose = () => {
                responseHandler.init()
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