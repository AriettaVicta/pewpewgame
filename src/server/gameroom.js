import Simulation from "../shared/simulation.js";
import Constants from "../shared/constants.js";

const ServerStepMs = 2;

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
  }

  reset() {
    this.player1 = null;
    this.player2 = null;
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
      return true;
    }
  }

  leaveRoom(socketId) {
    if (this.player1 && socketId == this.player1.socketId) {
      this.player1.socketId = null;
      this.simulation.p1.dead = true;
      this.gameOver();
    } else if (this.player2 && socketId == this.player2.socketId) {
      this.player2.socketId = null;
      this.simulation.p2.dead = true;
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
    this.gameState = GAMESTATE_GAMEOVER;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    //
    // Send the final update.
    //
    this.sendWorldUpdateToClients();
  }

  startGame() {
    var self = this;
    if (this.player1 && this.player2 &&
        this.player1.socketId && this.player2.socketId) {
      // Both players have joined.
      // Start the game

      this.gameState = GAMESTATE_STARTED;

      //
      // Create the simulation in the server
      // Send initial update to the client as part of start game message.
      // SetInterval to update the simulation every 100ms or so
      // and pass the updates to the clients.
      //
      this.simulation = new Simulation();
      this.simulation.initialize(Constants.PlayAreaWidth, Constants.PlayAreaHeight, this.player1.name, this.player2.name);
      
      let beginningWorldState = this.simulation.getWorldState();

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
    this.simulation.beforeRun();
    for (var elapsedTime = 0; elapsedTime < Constants.ServerUpdateMs; elapsedTime += ServerStepMs) {

      for (var i = this.unprocessedInput.length - 1; i >=0; --i) {
        let input = this.unprocessedInput[i];
        // Check if this input should be played back in this step.
        if (input.TimeSinceServerUpdate <= elapsedTime + ServerStepMs) {
          this.simulation.submitInput(input);
          this.unprocessedInput.splice(i, 1);
        }
      }

      this.simulation.update(elapsedTime, ServerStepMs);
    }

    if (this.unprocessedInput.length > 0) {
      for (var i = 0; i < this.unprocessedInput.length; i++) {
        this.simulation.submitInput(this.unprocessedInput[i]);
      }
    }
    this.unprocessedInput = [];

    // Delete removed bullets from the simulation.
    this.simulation.deleteRemovedBullets();

    // If the game is over, kill the timer.
    if (this.simulation.isGameOver()) {
      this.gameOver();
    } else {
      this.sendWorldUpdateToClients();
    }
  }

  sendWorldUpdateToClients() {
    let worldState = this.simulation.getWorldState();

    // Send clients the update.
    this.io.to(this.player1.socketId).emit('worldupdate', worldState);
    this.io.to(this.player2.socketId).emit('worldupdate', worldState);
  }
}