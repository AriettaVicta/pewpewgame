import { SuperCoolTest, NewTestDef } from "../shared/utils.js"
import GameRoom from "./gameroom.js";

export default class MyServer {

  gameRoom;

  constructor(io) {
    var self = this;

    this.gameRoom = new GameRoom(io);

    // Initialize socket IO handlers
    io.on('connection', (socket) => {
      console.log('a user connected');
      socket.on('disconnect', () => {
        self.gameRoom.leaveRoom(socket.id)
        console.log('user disconnected');
      });

      socket.on('ping', () => {
        socket.emit('pong');
      });

      socket.on('joingame', () => {
        // Try to join the game
        // if full, send an error
        var joined = self.gameRoom.joinRoom(socket.id);
        if (joined) {
          console.log('joined game');
          socket.emit('joingameresponse', true);
          self.gameRoom.startGame();
        } else {
          console.log('failed to join game');
          socket.emit('joingameresponse', false);
        }

      });

      socket.on('sendinput', (input) => {
        self.gameRoom.playerInput(socket.id, input);
      });
    });
  }
}