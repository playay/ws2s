/**
 * WS2SBase64
 * 
 * byteLength - Takes a base64 string and returns length of byte array
 * toByteArray - Takes a base64 string and returns a byte array
 * fromByteArray - Takes a byte array and returns a base64 string
 */
(function(r){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=r()}else if(typeof define==="function"&&define.amd){define([],r)}else{var e;if(typeof window!=="undefined"){e=window}else if(typeof global!=="undefined"){e=global}else if(typeof self!=="undefined"){e=self}else{e=this}e.WS2SBase64=r()}})(function(){var r,e,n;return function(){function r(e,n,t){function o(i,a){if(!n[i]){if(!e[i]){var u=typeof require=="function"&&require;if(!a&&u)return u(i,!0);if(f)return f(i,!0);var d=new Error("Cannot find module '"+i+"'");throw d.code="MODULE_NOT_FOUND",d}var c=n[i]={exports:{}};e[i][0].call(c.exports,function(r){var n=e[i][1][r];return o(n?n:r)},c,c.exports,r,e,n,t)}return n[i].exports}var f=typeof require=="function"&&require;for(var i=0;i<t.length;i++)o(t[i]);return o}return r}()({"/":[function(r,e,n){"use strict";n.byteLength=c;n.toByteArray=v;n.fromByteArray=s;var t=[];var o=[];var f=typeof Uint8Array!=="undefined"?Uint8Array:Array;var i="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";for(var a=0,u=i.length;a<u;++a){t[a]=i[a];o[i.charCodeAt(a)]=a}o["-".charCodeAt(0)]=62;o["_".charCodeAt(0)]=63;function d(r){var e=r.length;if(e%4>0){throw new Error("Invalid string. Length must be a multiple of 4")}return r[e-2]==="="?2:r[e-1]==="="?1:0}function c(r){return r.length*3/4-d(r)}function v(r){var e,n,t,i,a;var u=r.length;i=d(r);a=new f(u*3/4-i);n=i>0?u-4:u;var c=0;for(e=0;e<n;e+=4){t=o[r.charCodeAt(e)]<<18|o[r.charCodeAt(e+1)]<<12|o[r.charCodeAt(e+2)]<<6|o[r.charCodeAt(e+3)];a[c++]=t>>16&255;a[c++]=t>>8&255;a[c++]=t&255}if(i===2){t=o[r.charCodeAt(e)]<<2|o[r.charCodeAt(e+1)]>>4;a[c++]=t&255}else if(i===1){t=o[r.charCodeAt(e)]<<10|o[r.charCodeAt(e+1)]<<4|o[r.charCodeAt(e+2)]>>2;a[c++]=t>>8&255;a[c++]=t&255}return a}function l(r){return t[r>>18&63]+t[r>>12&63]+t[r>>6&63]+t[r&63]}function h(r,e,n){var t;var o=[];for(var f=e;f<n;f+=3){t=(r[f]<<16&16711680)+(r[f+1]<<8&65280)+(r[f+2]&255);o.push(l(t))}return o.join("")}function s(r){var e;var n=r.length;var o=n%3;var f="";var i=[];var a=16383;for(var u=0,d=n-o;u<d;u+=a){i.push(h(r,u,u+a>d?d:u+a))}if(o===1){e=r[n-1];f+=t[e>>2];f+=t[e<<4&63];f+="=="}else if(o===2){e=(r[n-2]<<8)+r[n-1];f+=t[e>>10];f+=t[e>>4&63];f+=t[e<<2&63];f+="="}i.push(f);return i.join("")}},{}]},{},[])("/")});

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
                // connection to ws2s server is open, 
                // socket is ready to use, now you can call socket.connect() method
                console.log('socket onReady')
            },
            onOpen: () => {
                // socket.connect() is done, 
                // socket is ready to for send data. now you can call socke.send() method
                console.log('socket onOpen')
            },
            onRecv: (bytes) => {
                // bytes is an Uint8Array
                console.log('socket onRecv: ', bytes)
            },
            onClose: () => {
                console.log('socket onClose')
            },
            onError: (error) => {
                console.log('socket onError: ', error)
            },
            /**
             * @param host a string
             * @param port an int
             */
            connect: (host, port) => {
                ws.send(JSON.stringify({
                    command: "connect",
                    host: host,
                    port: port
                }))
            },
            send: (string) => {
                ws.send(JSON.stringify({
                    command: "send",
                    data: string
                }))
            },
            /**
             * send bytes by base64
             * 
             * @param bytes an Uint8Array
             */
            sendb: (bytes) => {
                ws.send(JSON.stringify({
                    command: "sendb",
                    data: WS2SBase64.fromByteArray(bytes)
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
        var receivedBase64 = []
        ws.onmessage = (event) => {
            var response = JSON.parse(event.data)
            if (response.code < 0) {
                receivedBase64.push(response.data)
                if (!receiving) {
                    receiving = true
                    while (receivedBase64.length > 0) {
                        socket.onRecv(
                            WS2SBase64.toByteArray(
                                receivedBase64.shift()
                            )
                        )
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
            constructor(oldStatus, oldStatusParents) {
                this.init(oldStatus, oldStatusParents)
            }

            init(oldStatus, oldStatusParents){
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
                    depth: 0,
                    childrenStatus: null,

                    stringLengthByteList: [],
                    stringLength: -2,
                    stringIndex: 0,

                    complete: false,
                    isNullResult: false,
                    isEmptyResult: false,
                    resultByteList: [],
                }
                if (oldStatusParents) {
                    this.status.depth = oldStatusParents.depth + 1
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
                if (!this.status.rootType) {
                    let byte = byteList.shift()
                    if (byte === 10) {
                        byte = byteList.shift()
                    }
                    if (byte === undefined) {
                        return this.status
                    }
                    this.status.rootType = String.fromCharCode(byte)
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
                    if (this.status.arraySize === 0) {
                        this.status.complete = true
                        this.status.isEmptyResult = true
                    }
                    if (this.status.arraySize > 0) {
                        while(this.status.arrayIndex < this.status.arraySize && byteList.length > 0) {
                            var itemHandler = new ResponseHandler(this.status.childrenStatus, this.status)
                            var itemStatus = itemHandler.push(byteList)
                            while (!itemStatus.complete && byteList.length > 0) {
                                itemStatus = itemHandler.push(byteList)
                            }
                            if (itemStatus.complete && itemStatus.shiftOne) {
                                this.status.shiftOne = true
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
                                    for (let i = 0; i < this.status.depth; i++) {
                                        this.status.resultByteList.push(' '.charCodeAt(0))
                                        this.status.resultByteList.push(' '.charCodeAt(0))
                                        this.status.resultByteList.push(' '.charCodeAt(0))
                                    }
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
                let dataList = Array.from(data)
                while (dataList.length > 0) {
                    var status = responseHandler.push(dataList)
                    if (status.complete) {
                        if (status.isNullResult) {
                            redisClient.onError("a null object is recevied form redis server")
                            return
                        }
                        if (status.isEmptyResult) {
                            redisClient.onError("an empty result is recevied form redis server")
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