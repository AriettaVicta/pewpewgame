import { SuperCoolTest, NewTestDef } from "../shared/utils.js"

export default class MyServer {
  constructor(io) {
    var self = this;

    console.log('Code sharing Test: ' + SuperCoolTest);

    // Initialize socket IO handlers
    io.on('connection', (socket) => {
      console.log('a user connected');
      socket.on('disconnect', () => {
        console.log('user disconnected');
      });

      socket.on('hello', () => {
        console.log('got hello message');
        socket.emit('ack', 'hello UPD to yourself');
      });

      socket.on('test', () => {
        console.log('got test message');
        self.test();
        socket.emit('ack', 'test result');
        console.log('Done: ' + NewTestDef)
      });
    });
  }

  test() {
    console.log('testtestest');
  }
}