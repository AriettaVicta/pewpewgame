import { io, Socket } from "socket.io-client";
import { ServerPlayerInfo } from "../interfaces";

export default class SocketManager {

  socket : Socket;
  pingInterval;

  pingstart : number;
  latency : number;

  currentScene;
  playerName : string;
  playerList : [ServerPlayerInfo] | any;

  constructor() {
    var self = this;
    this.playerName = '';
    this.playerList = [];
    self.latency = 0;

    this.socket = io();
    this.socket.connect();

    // Incoming messages
    // Scenes should implement:
    //  joinGameResponse
    //  startGame
    //  opponentLeft
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
    this.socket.on('opponentLeft', (message) => {
      if (self.currentScene && self.currentScene.opponentLeft) {
        self.currentScene.opponentLeft(message);
      }
    })
    this.socket.on('nameupdate', (newName) => {
      self.playerName = newName;
      if (self.currentScene && self.currentScene.nameUpdate) {
        self.currentScene.nameUpdate(newName);
      }
    });
    this.socket.on('playerlist', (playerList) => {
      self.playerList = playerList;
      if (self.currentScene && self.currentScene.playerListUpdate) {
        self.currentScene.playerListUpdate(self.playerList);
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
    this.playerName = newName;
    this.socket.emit('updateplayername', newName);
  }

  getLatency() {
    return this.latency;
  }

  getPlayerList() {
    return this.playerList;
  }

}
