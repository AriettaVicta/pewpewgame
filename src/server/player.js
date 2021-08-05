import {ServerPlayerState} from '../shared/enums.js';

export default class Player {

  constructor(socketId, name) {
    this.socketId = socketId;
    this.name = name;
    this.state = ServerPlayerState.Lobby;
  }

}