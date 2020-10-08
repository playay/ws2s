## ws2s.js
ws2s.js is a websocket client wrapper that provide socket-like interface to communicate with ws2s_server.    

### socket_wrapper
```js
var socket = new WS2S("wss://ws2s.feling.net/").newSocket()

$('#connect-button').bind("click", () => {
    socket.connect("feling.net", 80)
})

$('#send-button').bind("click",  () => {
    socket.send("GET / HTTP/1.1\r\nHost: feling.net\r\nConnection: close\r\n\r\n")
})

$('#send-bytes-button').bind("click",  () => {
    socket.sendb(// send bytes by base64
        new TextEncoder('utf8')
            .encode('GET /xxx HTTP/1.1\r\nHost: feling.net\r\nConnection: close\r\n\r\n')
    )
})

$('#close-button').bind("click",  () => {
    socket.close()
})

socket.onReady = () => {
    // connection to ws2s server is open, 
    // socket is ready to use, now you can call socket.connect() method
    console.log('onReady')
}
socket.onOpen = () => {
    // socket.connect() is done, 
    // socket is ready to for send data. now you can call socke.send() method
    console.log('onOpen')
}
socket.onRecv = (bytes) => {
    // bytes is an Uint8Array
    console.log('socket onRecv: ', bytes)
}
socket.onClose = () => {
    console.log('onClose')
}
socket.onError = (error) => {
    console.log('onError', error)
}
```

### redis_wrapper
redis_wrapper is provided based on the socket_wrapper.    


based on redis_wrapper, an online redis gui client we called "fredis" is provided at [https://feling.net/redis/](https://feling.net/redis/).    

```javaScript
redis = new WS2S("wss://ws2s.feling.net/").newRedisCient("hostname", 6379) // (host, port, auth)

redis.onSocketReady: () => {
    // connection to ws2s server is open
    console.log('redisClient onSocketReady')
}
redis.onReady = () => {
    // socket.connect() method has been successfully executed, 
    // redis.request('auth xxx') has been send, if need auth.
    console.log('redisClient onReady')
}
redis.onResponse = (data) => {
    console.log(data)
}
redis.onError = (error) => {
    console.log('redisClient onError: ', error)
}

$('#button').bind("click", () => {
    redis.request('ping')
    redis.request('get name')
    redis.request('set age 24')
    redis.request('get age\n\nincr age\nget age')
    redis.request('ECHO "Hello World!"')
})
```

