
ws2s--bring socket to browser-side js
=====================================
ws2s(websocket to socket) is a websocket server that handle socket(tcp)s.   

the simplest workflow might be like this:    

first, a websocket client(we called "ws") ask ws2s_server to create a socket(we called "s") for it.    
then, "ws" ask ws2s_server to use "s" to send data.    
when "s" received data, ws2s_server will notify "ws" with the received data.    

with this workflow, javaScript running on a browser got the ability to use socket.    


ws2s.js(upcoming)
=================
[ws2s-js](https://github.com/playlay/ws2s-js) is a javaScript websocket client wrapper that provide socket-like interface to communicate with ws2s_server.    
based on the socketWrapper, other wrappers like redisWrapper will be provided. then an online redis client will be available at [fredis](https://feling.io/redis/).    


install
=======
ws2s works on py2、py3、windows、linux、osx.    

if you are using python 3.6, you can install ws2s from pypi:    
```shell
pip install ws2s-python --upgrade
```

if you can't install ws2s from pypi:    
```shell
pip install git+https://github.com/playlay/ws2s
```

after install ws2s:     
`ws2sd` command can be used in shell,     
`~/.ws2s/` directory will be created when you exec `ws2sd`      


config
======
config file is store at `~/.ws2s/config.json`.    


client case
============
```
var ws = new WebSocket("wss://feling.io/ws2s-server/")
ws.onmessage = (event) => {
    console.log("onmessage: ", event.data)
}
ws.onopen = (event) => {
    console.log("onopen")
    ws.send(JSON.stringify(
        {
            command: "connect",
            host: "www.baidu.com",
            port: 80
        }
    ))
    ws.send(JSON.stringify(
        {
            command: "send",
            data: "GET / HTTP/1.1\r\nHost: www.baidu.com\r\nConnection: close\r\n\r\n"
        }
    ))
}
ws.onclose = () => {
    console.log("onclose")
}
```

protocol
========

request
-------

all kinds of requests are listed below:     
```json
{
    "command": "connect",
    "host":"127.0.0.1",
    "port":80
}
{
    "command": "send",
    "data":"GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n"
}
{
    "command": "close"
}
```
you can find out that:    

1. message(we called request) send to ws2s_sever is a json format string.   
2. a "command" field is required    

response
--------
message(we called response) received from ws2s_sever, is a json format string too:      
```json
{
    "success": true,
    "code": -1,
    "message": "recv data",
    "data": ""
}
```
```
As in the example above:    
- "message" field is for human.   
- "success" field can be ignored.     

when "code" field = -1, "data" field is presented.     
    that means ws2s_server received data from peer.      

when "code" field = 0.      
    usually means ws2s_server successfully completed the most recent command    

when "code" field > 0.      
    means something is not normal:      
    when "code" = 1:    
        unknown exception, you can submit an issue to ws2s    

    when "code" = 2:    
        ConnectionRefusedError raisesd when ws2s_server try to   
        connect host:port you specified    

    when "code" = 3:    
        IllegalSocketState, just reSend an "connect" request like:    
        {"command":"connect","host":"127.0.0.1","port":80}    

    when "code" = 4:    
        usually means you want ws2s_server to connect 127.0.0.1,    
        but ws2s_server refused to do that     
```


todo
====
- auto-start on boot (ubuntu)
- ws2s.js
- fredis
