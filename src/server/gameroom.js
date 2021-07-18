import Simulation from "../shared/simulation.js";
import Constants from "../shared/constants.js";

const ServerStepMs = 2;

export default class GameRoom {

  io;
  p1SocketId;
  p2SocketId;

  unprocessedInput;

  constructor(io) {
    this.io = io;

    this.unprocessedInput = [];
  }

  reset() {
    this.p1SocketId = null;
    this.p2SocketId = null;
  }

  joinRoom(socketId) {
    if (this.p1SocketId && this.p2SocketId) {
      return false;
    } else {
      if (this.p1SocketId) {
        this.p2SocketId = socketId;
      } else {
        this.p1SocketId = socketId;
      }
      return true;
    }
  }

  leaveRoom(socketId) {
    if (socketId == this.p1SocketId) {
      this.p1SocketId = null;
      this.simulation.p1.dead = true;
      this.gameOver();
    } else if (socketId == this.p2SocketId) {
      this.p2SocketId = null;
      this.simulation.p2.dead = true;
      this.gameOver();
    }
  }

  gameOver() {
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
    if (this.p1SocketId && this.p2SocketId) {
      // Both players have joined.
      // Start the game

      //
      // Create the simulation in the server
      // Send initial update to the client as part of start game message.
      // SetInterval to update the simulation every 100ms or so
      // and pass the updates to the clients.
      //
      this.simulation = new Simulation();
      this.simulation.initialize(Constants.PlayAreaWidth, Constants.PlayAreaHeight);
      
      let beginningWorldState = this.simulation.getWorldState();

      if (this.timer) {
        clearInterval(this.timer);
      }
      this.timer = setInterval(() => {
        self.worldUpdate()
      }, Constants.ServerUpdateMs);

      this.io.to(this.p1SocketId).emit('startgame', {
        side: 1,
        worldState: beginningWorldState,
      });
      this.io.to(this.p2SocketId).emit('startgame', {
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

    if (this.p1SocketId == socketId) {
      characterInput.OwnerId = 1;
    } else if (this.p2SocketId == socketId) {
      characterInput.OwnerId = 2;
    } else {
      console.log("ERROR: Couldn't find player")
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
    this.io.to(this.p1SocketId).emit('worldupdate', worldState);
    this.io.to(this.p2SocketId).emit('worldupdate', worldState);
  }
}