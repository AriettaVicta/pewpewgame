import Constants from "../shared/constants.js";
import {ReportResult, ServerPlayerState} from '../shared/enums.js';

const GAMESTATE_WAITINGFORPLAYERS = 1;
const GAMESTATE_STARTED = 2;
const GAMESTATE_GAMEOVER = 3;

export default class PeerGameRoom {

  io;

  player1;
  player2;
  gameState;

  resultFromPlayer1;
  resultFromPlayer2;

  constructor(io) {
    this.io = io;

    this.gameState = GAMESTATE_WAITINGFORPLAYERS;
  }

  joinRoom(player, peerId) {
    player.peerId = peerId;
    if (this.player1 && this.player2) {
      return false;
    } else {
      if (this.player1) {
        this.player2 = player;
      } else {
        this.player1 = player;
      }
      player.state = ServerPlayerState.Searching;
      return true;
    }
  }

  leaveRoom(socketId) {
    if (this.player1 && socketId == this.player1.socketId) {
      this.opponentLeft(this.player2);
    } else if (this.player2 && socketId == this.player2.socketId) {
      this.opponentLeft(this.player1);
    }
  }

  isGameFinished() {
    return (this.gameState == GAMESTATE_GAMEOVER);
  }

  isWaitingForPlayers() {
    return (this.gameState == GAMESTATE_WAITINGFORPLAYERS)
  }

  opponentLeft(playerStillHere) {
    this.gameState = GAMESTATE_GAMEOVER;
    if (playerStillHere) {
      this.io.to(playerStillHere.socketId).emit('opponentLeft');
    }
  }

  reportResult(socketId, message) {
    if (this.player1 && socketId == this.player1.socketId) {
      this.resultFromPlayer1 = message.Result;
    } else if (this.player2 && socketId == this.player2.socketId) {
      this.resultFromPlayer2 = message.Result;
    }

    if (this.resultFromPlayer1 != ReportResult.None && this.resultFromPlayer2 != ReportResult.None) {
      if (this.resultFromPlayer1 != this.resultFromPlayer2) {
        // Disagree on result.
        console.log("Match result: p1: " + this.resultFromPlayer1 + ' p2: ' + this.resultFromPlayer2);
        // TODO: Figure out what to do.
      } else {
        // Agree on result.
        console.log("Match result: " + this.resultFromPlayer1);
        // TODO: log the result somewhere?
      }
      this.gameState = GAMESTATE_GAMEOVER;
    }
  }

  startGame() {

    var self = this;
    if (this.player1 && this.player2 &&
        this.player1.socketId && this.player2.socketId) {
      // Both players have joined.
      // Start the game

      this.gameState = GAMESTATE_STARTED;
      this.player1.state = ServerPlayerState.Playing;
      this.player2.state = ServerPlayerState.Playing;
      this.resultFromPlayer1 = ReportResult.None;
      this.resultFromPlayer2 = ReportResult.None;

      this.io.to(this.player1.socketId).emit('startgame', {
        host: true,
        opponentPeerId: this.player2.peerId,
        p1Name: this.player1.name,
        p2Name: this.player2.name,
      });
      this.io.to(this.player2.socketId).emit('startgame', {
        host: false,
        opponentPeerId: this.player1.peerId,
        p1Name: this.player1.name,
        p2Name: this.player2.name,
      });
    }
  }
}