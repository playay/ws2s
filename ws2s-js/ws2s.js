class WS2S {
    constructor(serverAdderss) {
        this._ws = new WebSocket(serverAdderss)
        this._ws.onclose = () => {
            this._socket.onClose("connection to ws2s server was closed")
        }
        this._ws.onerror = (error) => {
            this._socket.onError(error)
        }
        this._ws.onmessage = (event) => {
            var response = JSON.parse(event.data)
            if (response.code < 0) {
                this._socket.onRecv(event.data)
                return
            }
            if (response.code == 0) {
                if (response.message == 'connect done') {
                    this._socket.onOpen()
                }
                if (response.message == 'close done') {
                    this._socket.onClose('close done')
                }
                return
            }
            if (response.code == 3) {
                this._socket.onClose(response.message)
                return
            }
            this._socket.onError(response)
        }

        this._socket = {
            onOpen: () => {
            },
            onRecv: (data) => {
            },
            onClose: (reason) => {
            },
            onError: (error) => {
            },
            connect: (host, port) => {
                this._target = {host: host, port: port}
                this._ws.send(JSON.stringify({
                    command: "connect",
                    host: host,
                    port: port
                }))
            },
            send: (data) => {
                this._ws.send(JSON.stringify({
                    command: "send",
                    data: data
                }))
            },
            close: () => {
                this._ws.send(JSON.stringify({
                    command: "close"
                }))
            }
        }
    }

    socket() {
        return this._socket
    }

    redis() {
        return this._redis
    }

};