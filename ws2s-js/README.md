## ws2s.js
[ws2s-js](ws2s-js/) is a javaScript websocket client wrapper that provide socket-like interface to communicate with ws2s_server.    

### socket_wrapper
```javaScript
var ws2s = new WS2S("wss://feling.io/ws2s-server/")
var socket = ws2s.socket()
socket.onOpen = () => {
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
$('#connect-button').bind("click", () => {
    socket.connect("feling.io", 80)
})

$('#send-button').bind("click",  () => {
    socket.send("GET / HTTP/1.1\r\nHost: feling.io\r\nConnection: close\r\n\r\n")
})

$('#close-button').bind("click",  () => {
    socket.close()
})
```

(upcoming)      
based on the socket_wrapper, other wrappers like redis_wrapper will be provided. then an online redis client will be available at [fredis](https://feling.io/redis/).    

