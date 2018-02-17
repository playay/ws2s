## ws2s.js
ws2s.js is a javaScript websocket client wrapper that provide socket-like interface to communicate with ws2s_server.    

### socket_wrapper
```javaScript
var socket = WS2S.init("wss://feling.io/ws2s-server/").newSocket()

$('#connect-button').bind("click", () => {
    socket.connect("feling.io", 80)
})

$('#send-button').bind("click",  () => {
    socket.send("GET / HTTP/1.1\r\nHost: feling.io\r\nConnection: close\r\n\r\n")
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
socket.onRecv = (data) => {
    console.log('onRecv', data)
}
socket.onClose = (reason) => {
    console.log('onClose', reason)
}
socket.onError = (error) => {
    console.log('onError', error)
}
```

### redis_wrapper
redis_wrapper is provided based on the socket_wrapper.

```javaScript
redis = WS2S.init("wss://feling.io/ws2s-server/")
            .newRedisCient("hostname", 6379) // (host, port, auth)

redis.onResponse = (data) => {
    console.log(data)
}

$('#button').bind("click", () => {
    redis.request('ping')
    redis.request('get name')
    redis.request('set age 24')
    redis.request('get age\n\nincr age\nget age')
    redis.request('ECHO "Hello World!"')
})
```

(upcoming)      
based on redis_wrapper, an online redis client will be available at [fredis](https://feling.io/redis/).    

