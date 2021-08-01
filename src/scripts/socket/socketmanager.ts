import { io, Socket } from "socket.io-client";

export default class SocketManager {

  socket : Socket;
  pingInterval;

  pingstart : number;
  latency : number;

  currentScene;
  playerName : string;

  constructor() {
    var self = this;
    this.playerName = '';

    this.socket = io();
    this.socket.connect();

    // Incoming messages
    // Scenes should implement:
    //  joinGameResponse
    //  startGame
    //  worldUpdate
    //
    this.socket.on("joingameresponse", (success) => {
      if (self.currentScene && self.currentScene.joinGameResponse) {
        self.currentScene.joinGameResponse(success);
      }
    });
    this.socket.on('startgame', (message) => {
      if (self.currentScene && self.currentScene.startGame) {
        self.currentScene.startGame(message);
      }
    });
    this.socket.on('worldupdate', (worldState) => {
      if (self.currentScene && self.currentScene.worldUpdate) {
        self.currentScene.worldUpdate(worldState);
      }
    })
    this.socket.on('nameupdate', (newName) => {
      self.playerName = newName;
      if (self.currentScene && self.currentScene.nameUpdate) {
        self.currentScene.nameUpdate(newName);
      }
    });

    this.socket.on('pong', () => {
      self.latency = Date.now() - self.pingstart;
    });

    this.pingInterval = setInterval(() => {
      self.pingstart = Date.now();
      // volatile, so the packet will be discarded if the socket is not connected
      self.socket.volatile.emit("ping");
    }, 2000); 
  }

  setCurrentScene(scene) {
    this.currentScene = scene;
  }

  emit(emitString, param) {
    this.socket.emit(emitString, param);
  }

  getPlayerName() {
    return this.playerName;
  }

  updatePlayerName(newName) {
    this.socket.emit('updateplayername', newName);
  }

  getLatency() {
    return this.latency;
  }

}
