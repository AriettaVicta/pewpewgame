import { SuperCoolTest, NewTestDef } from "../shared/utils.js"
import GameRoom from "./gameroom.js";
import Player from "./player.js";

export default class MyServer {

  gameRooms;
  availableRoom;
  players;

  constructor(io) {
    var self = this;

    this.players = [];
    this.gameRooms = [];
    this.availableRoom = new GameRoom(io);

    // Initialize socket IO handlers
    io.on('connection', (socket) => {
      console.log('a user connected');

      // Add the new player to the list of players
      let newPlayer = new Player(socket.id, self.generatePlayerName());
      this.players.push(newPlayer);

      socket.emit('nameupdate', newPlayer.name);

      socket.on('updateplayername', (newName) => {
        let player = self.getPlayerBySocket(socket.id);
        if (player) {
          if (self.isValidName(newName)) {
            console.log('player changed name: ' + newName);
            player.name = newName;
          } else {
            console.log('player denied name: ' + newName);
            socket.emit('nameupdate', player.name);
          }
        }
      });

      socket.on('disconnect', () => {
        self.userLeftRoom(socket.id);
        for (var i = 0; i < this.players.length; i++) {
          let player = this.players[i];
          if (player.socketId == socket.id) {
            this.players.splice(i, 1);
            break;
          }
        }
        console.log('user disconnected');
      });

      socket.on('ping', () => {
        socket.emit('pong');
      });

      socket.on('joingame', () => {
        // Try to join the game
        // if full, send an error
        var joined = self.availableRoom.joinRoom(this.getPlayerBySocket(socket.id));
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

  getPlayerBySocket(socketId) {
    for (var i = 0; i < this.players.length; i++) {
      let player = this.players[i];
      if (player.socketId == socketId) {
        return player;
      }
    }
    return null;
  }

  isValidName(newName) {
    for (var i = 0; i < this.players.length; i++) {
      let player = this.players[i];
      if (player.name == newName) {
        return false;
      }
    }
    return true;
  }

  generatePlayerName() {
    let nameToUse = null;
    do
    {
      let playerId = Math.round(Math.random() * 100000);
      let name = 'Player' + playerId;
      let validName = this.isValidName(name);
      if (validName) {
        nameToUse = name;
      }
      console.log('trying name' + nameToUse)
    } while (nameToUse == null)
    return nameToUse;
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