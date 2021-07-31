import { SuperCoolTest, NewTestDef } from "../shared/utils.js"
import GameRoom from "./gameroom.js";

export default class MyServer {

  gameRooms;
  availableRoom;

  constructor(io) {
    var self = this;

    this.gameRooms = [];
    this.availableRoom = new GameRoom(io);

    //this.gameRoom = new GameRoom(io);

    // Initialize socket IO handlers
    io.on('connection', (socket) => {
      console.log('a user connected');
      socket.on('disconnect', () => {
        self.userLeftRoom(socket.id);
        console.log('user disconnected');
      });

      socket.on('ping', () => {
        socket.emit('pong');
      });

      socket.on('joingame', () => {
        // Try to join the game
        // if full, send an error
        var joined = self.availableRoom.joinRoom(socket.id);
        if (joined) {
          console.log('joined game');
          socket.emit('joingameresponse', true);
          self.availableRoom.startGame();
        } else {
          console.log('failed to join game');
          socket.emit('joingameresponse', false);
        }

        // If the available is full and just started,
        // go ahead and add it to the list of rooms.
        if (!self.availableRoom.isWaitingForPlayers()) {
          self.gameRooms.push(self.availableRoom);
          self.availableRoom = new GameRoom(io);
        }
      });

      socket.on('leavegame', () => {
        // Find game room player is in and leave it.
        self.userLeftRoom(socket.id);
        console.log('user left room');
      });

      socket.on('sendinput', (input) => {
        for (var i = 0; i < self.gameRooms.length; i++) {
          let room = self.gameRooms[i];
          room.playerInput(socket.id, input);
        }
      });
    });
  }

  userLeftRoom(socketId) {
    for (var i = this.gameRooms.length - 1; i >= 0; i--) {
      let room = this.gameRooms[i];
      room.leaveRoom(socketId);
      if (room.isGameFinished()) {
        this.gameRooms.splice(i, 1);
      }
    }
  }
}