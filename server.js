const path = require('path');
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

const DIST_DIR = path.join(__dirname, '/dist');
const HTML_FILE = path.join(DIST_DIR, 'index.html');

app.use(express.static(DIST_DIR));
app.get('*', (req, res) => {
  res.sendFile(HTML_FILE);
});

const PORT = process.env.PORT || 3000;

io.on('connection', (socket) => {
  console.log('a user connected');
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });

  socket.on('hello', () => {
    console.log('got hello message');
    socket.emit('ack', 'hello yourself');
  });

  socket.on('test', () => {
    console.log('got test message');
    socket.emit('ack', 'test result');
  });

});

server.listen(PORT, () => {
  console.log("Listening on *:" + PORT);
});

// app.listen(PORT, () => {
//   console.log("APP Listening on *:" + PORT);
// });