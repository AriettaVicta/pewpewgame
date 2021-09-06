import Simulation from "../shared/simulation.js";
import Constants from "../shared/constants.js";
import {ServerPlayerState} from '../shared/enums.js';

const GAMESTATE_WAITINGFORPLAYERS = 1;
const GAMESTATE_STARTED = 2;
const GAMESTATE_GAMEOVER = 3;

export default class GameRoom {

  io;

  player1;
  player2;
  gameState;

  unprocessedInput;

  constructor(io) {
    this.io = io;

    this.unprocessedInput = [];

    this.gameState = GAMESTATE_WAITINGFORPLAYERS;
    this.simulation = new Simulation();
  }

  joinRoom(player) {
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
      this.simulation.killPlayer(1);
      this.gameOver();
    } else if (this.player2 && socketId == this.player2.socketId) {
      this.simulation.killPlayer(2);
      this.gameOver();
    }
  }

  isGameFinished() {
    return (this.gameState == GAMESTATE_GAMEOVER);
  }

  isWaitingForPlayers() {
    return (this.gameState == GAMESTATE_WAITINGFORPLAYERS)
  }

  gameOver() {
    let alreadyStarted = (this.gameState != GAMESTATE_WAITINGFORPLAYERS);
    this.gameState = GAMESTATE_GAMEOVER;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    //
    // Send the final update.
    //
    if (alreadyStarted) {
      this.sendWorldUpdateToClients();
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

      //
      // Create the simulation in the server
      // Send initial update to the client as part of start game message.
      // SetInterval to update the simulation every 100ms or so
      // and pass the updates to the clients.
      //
      this.simulation.initialize(Constants.PlayAreaWidth, Constants.PlayAreaHeight, this.player1.name, this.player2.name);
      
      let beginningWorldState = this.simulation.getLatestWorldState();

      if (this.timer) {
        clearInterval(this.timer);
      }
      this.timer = setInterval(() => {
        self.worldUpdate()
      }, Constants.ServerUpdateMs);

      this.io.to(this.player1.socketId).emit('startgame', {
        side: 1,
        worldState: beginningWorldState,
      });
      this.io.to(this.player2.socketId).emit('startgame', {
        side: 2,
        worldState: beginningWorldState,
      });
    }
  }

  playerInput(socketId, characterInput) {

    //
    // TODO:
    // Validate input for cheating.
    //

    if (this.player1 && this.player1.socketId == socketId) {
      characterInput.OwnerId = 1;
    } else if (this.player2 && this.player2.socketId == socketId) {
      characterInput.OwnerId = 2;
    } else {
      //console.log("ERROR: Couldn't find player")
      return;
    }

    //  
    // Store the input to process on the next simulation update.
    //
    this.unprocessedInput.push(characterInput);
  }

  worldUpdate() {
    //
    // This is called on a timer to run the simulation.
    // After that, send world state to players.
    //

    // Update the world at ServerStepMs.
    // Insert saved input based on client timestamp.


    ///
    // Input will have a timestamp that indicates when it is supposed to be played
    // Submit that input to that state.
    // Start at the latest state and play all the input to get to the latest state
    //

    for (var i = this.unprocessedInput.length - 1; i >=0; --i) {
      let input = this.unprocessedInput[i];

      if (this.simulation.submitInput(input)) {
        this.unprocessedInput.splice(i, 1);
      }
    }

    // 
    this.simulation.run();

    // If the game is over, kill the timer.
    if (this.simulation.isGameOver()) {
      this.gameOver();
    } else {
      this.sendWorldUpdateToClients();
    }
  }

  sendWorldUpdateToClients() {
    let worldState = this.simulation.getLatestWorldState();

    // Send clients the update.
    this.io.to(this.player1.socketId).emit('worldupdate', worldState);
    this.io.to(this.player2.socketId).emit('worldupdate', worldState);
  }
}