/*
 * Server for the Sea Combat network game
 * Created by Volodymyr Lomako on 01.10.2016.
 */

var express = require('express');
var app = express();
var http = require('http').Server(app);

var io = require('socket.io')(http);
var freesocket;

app.use('/files', express.static('files'));
app.use('/graph', express.static('graph'));
app.use('/sound', express.static('sound'));

app.get('/', (req, res) => { res.sendFile(__dirname + '/files/index.html'); });

io.on('connection', socket => {
    // New user connected. Do nothing.
    socket.on('disconnect', () => {
        if (socket.playmate) {
            socket.playmate.emit('link lost');
            delete socket.playmate.playmate;
        }
    });
    socket.on('register', gamerdata => {
        if (freesocket) {
            freesocket.playmate = socket;
            socket.playmate = freesocket;
            freesocket = undefined;
            socket.playmate.emit('register', gamerdata);
            socket.emit('register', socket.playmate.gamerdata);
        } else {
            gamerdata.firstmove = false;
            socket.gamerdata = gamerdata;
            freesocket = socket;
        }
    });
    socket.on('move', coordinates => {
        socket.playmate.emit('move', coordinates);
    });
    socket.on('game over', () => {
        // socket.playmate.emit('game over');
        delete socket.playmate;
    });
});

http.listen(3000, () => { console.log('listening on *:3000'); });