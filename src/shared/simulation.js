import Constants from "../shared/constants.js";
import SimState from "./sim-state.js";
import cloneDeep from 'lodash.clonedeep';

export default class Simulation {

  latestState;
  prevState;
  prevState2;

  playAreaWidth;// : number;
  playAreaHeight;// : number;

  nextBulletId;// : number;

  constructor() {
  }

  initialize(playAreaWidth, playAreaHeight, player1Name, player2Name) {

    var self = this;

    this.nextBulletId = 1;

    this.playAreaWidth = playAreaWidth;
    this.playAreaHeight = playAreaHeight;

    // Create initial state
    this.latestState = new SimState(() => {
      return self.getNextBulletId();
    }, 0, playAreaWidth, playAreaHeight, player1Name, player2Name);
    this.prevState = new SimState(() => {
      return self.getNextBulletId();
    }, 0, playAreaWidth, playAreaHeight, player1Name, player2Name);
    this.prevState2 = new SimState(() => {
      return self.getNextBulletId();
    }, 0, playAreaWidth, playAreaHeight, player1Name, player2Name);

    this.prevState.stateStartTime = -Constants.ServerUpdateMs;
    this.prevState2.stateStartTime = -Constants.ServerUpdateMs*2;
  }

  getNextBulletId() {
    return this.nextBulletId++;
  }


  killPlayer(num) {
    if (this.prevState2) this.prevState2.setPlayerDead(num);
    if (this.prevState) this.prevState.setPlayerDead(num);
    if (this.latestState) this.latestState.setPlayerDead(num);
  }

  submitInput(characterInput) {
    //
    // Look at the timestamp to find which state it goes to.
    //    The timestamp will be elapsed game time
    // Submit it to that state
    // Set that state as dirty
    //
    if (this.latestState.containsEventTime(characterInput.TimeOfEvent)) {
      this.latestState.submitInput(characterInput);
    } else if (this.prevState && this.prevState.containsEventTime(characterInput.TimeOfEvent)) {
      this.prevState.submitInput(characterInput);
    } else if (this.prevState2 && this.prevState2.containsEventTime(characterInput.TimeOfEvent)) {
      this.prevState2.submitInput(characterInput);
    } else if (characterInput.TimeOfEvent > this.latestState.elapsedTime + Constants.ServerUpdateMs) {
      // Event is in the future,
      // leave it in the input queue
      console.log('save input for later');
      return false;
    } else {
      // Event is too old, drop it.
      console.log('drop old input');
    }

    return true;
  }

  getLatestWorldState() {
    return {
      stateElapsedTime: this.latestState.stateStartTime,
      p1: this.latestState.p1,
      p2: this.latestState.p2,
      bullets: this.latestState.bullets,
    };
  }

  run() {
    //
    // If the previous states are dirty, run them again.
    //
    // To run a state, do the loop
    // for (var elapsedTime = 0; elapsedTime < Constants.ServerUpdateMs; elapsedTime += ServerStepMs) {
    // making sure to run input at the right time.
    if (this.prevState2) {
      // If there is input to run.
      // Run this state so we can generate a new
      // starting state for prevState.
      if (this.prevState2.dirty) {
        // Run prevState2 to generate a new prevState.
        this.prevState2.runState(Constants.ServerUpdateMs);

        // Now prevState2 has been moved forward.
        // Update starting bullets/player positions in  prevState
        // Then run prevState
        this.prevState.updateFromState(this.prevState2);
      } else {
        // It wasn't dirty, so effectively this state falls off.
        // and prevState just becomes prevState2.
      }
    }

    if (this.prevState) {
      this.prevState2 = cloneDeep(this.prevState);
      this.prevState2.dirty = false;
    }

    if (this.prevState) {
      if (this.prevState.dirty) {
        this.prevState.runState(Constants.ServerUpdateMs);

        this.latestState.updateFromState(this.prevState);
      }
    }

    this.prevState = cloneDeep(this.latestState);
    this.prevState.dirty = false;

    // Update the latest state
    // This moves it forward in time and clears the input.
    this.latestState.runState(Constants.ServerUpdateMs);
  }

  isGameOver() {
    return this.prevState2 && this.prevState2.isGameOver();
  }

}

