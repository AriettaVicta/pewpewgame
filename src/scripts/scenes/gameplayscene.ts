import FpsText from '../objects/fpsText'
import TextButton from '../objects/textbutton';
import Constants from '../../shared/constants';
import BulletGraphic from '../objects/bulletgraphic';
import {ReportResult, ShotType} from '../../shared/enums';
import CharacterGraphic from '../objects/charactergraphic';
import SimBullet from '../../shared/sim-bullet';
import ShotDefinitions from '../../shared/shotdefs';
import VirtualJoyStick from 'phaser3-rex-plugins/plugins/virtualjoystick.js';
import EnergyBar from '../objects/energybar';

import Peer from 'peerjs';

import { NetplayPlayer } from 'netplayjs';

import { RollbackNetcode } from '../netcode/rollback';
import EWMASD from '../netcode/ewmasd';

import { v4 as uuidv4 } from 'uuid';
import { GameInput } from '../gamestate/types';
import { GameState } from '../gamestate/gamestate';
import SimpleAI from '../ai/simpleai';

const PING_INTERVAL = 100;


const PlayerColor = 0x1fe5ff;
const EnemyColor = 0xff0090;

const NoMansZoneWidth = 40;
const NoMansZoneX = Constants.PlayAreaBufferX + Constants.PlayAreaWidth / 2 - NoMansZoneWidth/2;
const NoMansZoneColor = 0xFF0000;

const Depth_UI = 1000;

enum InputState {
  WaitingToJoinGame,
  Playing,
  GameOver,
}

const Player1SideLeft = 1;
const Player2SideRight = 2;

export default class GameplayScene extends Phaser.Scene {
  fpsText: FpsText;
  weaponSelectionText : Phaser.GameObjects.Text;
  gameOverText : Phaser.GameObjects.Text;
  onlineInfoText : Phaser.GameObjects.Text;
  latencyText : Phaser.GameObjects.Text;
  player1NameText : Phaser.GameObjects.Text;
  player2NameText : Phaser.GameObjects.Text;
  waitingForPlayerText : Phaser.GameObjects.Text;
  inputState : InputState;
  keys;
  playArea : Phaser.GameObjects.Rectangle;
  noMansZone : Phaser.GameObjects.Rectangle;
  accumulatedTime : number;

  mouseAimLine : Phaser.GameObjects.Line;
  mouseAimAngle : number;

  playerGraphic : CharacterGraphic;
  enemyGraphic : CharacterGraphic;

  playerHealthIndicator : EnergyBar;
  enemyHealthIndicator : EnergyBar;
  playerEnergyIndicator : EnergyBar;
  enemyEnergyIndicator : EnergyBar;

  spaceWasDown : boolean;
  pWasDown : boolean;
  mWasDown : boolean;
  nWasDown : boolean;
  oneWasDown: boolean;
  twoWasDown : boolean;
  mouseDown : boolean;
  mouseFire : boolean;
  bulletGraphics : BulletGraphic[];

  newGameButton : TextButton;
  leaveGameButton : TextButton;

  myPlayerSide : number;

  game : any;

  currentWeapon : number;
  weaponSelectbuttons : [TextButton] | any;

  joystick : VirtualJoyStick;
  joystickJustPressed : boolean;

  vsAI : boolean;
  aiPlayer : SimpleAI;

  // Peer stuff
  peer : Peer | null;
  peerId : string;
  connection : Peer.DataConnection | null;
  rollbackNetcode : RollbackNetcode<GameState, GameInput> | null;
  host : boolean;
  players : Array<NetplayPlayer>;
  pingMeasure: EWMASD = new EWMASD(0.2);
  gameState : GameState;
  opponentPeerId : string;
  pingInterval : NodeJS.Timeout | null;
  showRollbackDebugText : boolean;

  constructor() {
    super({ key: 'GameplayScene' })

    this.showRollbackDebugText = false;
  }

  handleRemoteData(data) {
    if (data.type == 'input') {
      if (this.rollbackNetcode == null) {
        console.log('not ready for input yet!')
      } else {
        let remotePlayerIndex = (this.host ? 1 : 0);
        let input = new GameInput();
        input.deserialize(data.input);
        this.rollbackNetcode!.onRemoteInput(data.frame, this.players![remotePlayerIndex], input);
      }
    } else if (data.type == 'state') {
      this.rollbackNetcode!.onStateSync(data.frame, data.state);
    } else if (data.type == "ping-req") {
      this.sendPeerMessage({ type: "ping-resp", sent_time: data.sent_time });
    } else if (data.type == "ping-resp") {
      this.pingMeasure.update(Date.now() - data.sent_time);
    } else if (data.type == "startmatch") {
      // Client starts match
      this.host = false;
      this.startMatch();
    } else {
      console.log(data);
    }
  }

  startMatch() {
    var self = this;

    this.gameState = new GameState();

    this.beginNewGame();

    if (self.host) { // Host
      this.myPlayerSide = Player1SideLeft;
      //self.connection.send({ type: "startmatch" })
      self.players = [
        new NetplayPlayer(0, true, true), // Player 0 is us, acting as a host.
        new NetplayPlayer(1, false, false), // Player 1 is our peer, acting as a client.
      ];
    } else { // Client
      this.myPlayerSide = Player2SideRight;
      self.players  = [
        new NetplayPlayer(0, false, true), // Player 0 is our peer, the host.
        new NetplayPlayer(1, true, false), // Player 1 is us, a client
      ];
    }
    this.setupNetcode();
  }

  getInitialInputs(
    players: Array<NetplayPlayer>
  ): Map<NetplayPlayer, GameInput> {
    let initialInputs: Map<NetplayPlayer, GameInput> = new Map();
    for (let player of players) {
      initialInputs.set(player, new GameInput());
    }
    return initialInputs;
  }

  sendPeerMessage(message) {
    var self = this;

    const DEBUG_DELAY = 0;

    if (DEBUG_DELAY) {
      setTimeout(() => {
        self.sendMessageOverConnection(message);
      }, DEBUG_DELAY);
    } else {
      self.sendMessageOverConnection(message);
    }
  }

  sendMessageOverConnection(message) {
    if (this.vsAI) {
      this.aiPlayer.onPeerMessage(message);
    } else {
      this.connection!.send(message);
    }
  }

  setupNetcode() {
    var self = this;

    this.rollbackNetcode = new RollbackNetcode(
      self.host, // host
      self.gameState,
      self.players,
      self.getInitialInputs(self.players),
      10, // maxPredictedFrames
      this.pingMeasure,
      Constants.Timestep,
      () => self.getInput(),
      (frame, input) => { // broadcast input
        self.sendPeerMessage({ type: "input", frame: frame, input: input.serialize() });
      },
      (frame, state) => { // broadcast state
        self.sendPeerMessage({ type: "state", frame: frame, state: state });
      }
    )

    this.pingInterval = global.setInterval(() => {
      self.sendPeerMessage({ type: "ping-req", sent_time: Date.now() });
    }, PING_INTERVAL);

    this.rollbackNetcode!.start();
  }

  getInput() : GameInput {
    let input = new GameInput();

    // Movement
    let movement = {
      Vertical: 0,
      Horizontal: 0,
    }
    if (this.keys.W.isDown) {
      movement.Vertical = -1;
    } else if (this.keys.S.isDown){
      movement.Vertical = 1;
    }

    if (this.keys.A.isDown) {
      movement.Horizontal = -1;
    } else if (this.keys.D.isDown){
      movement.Horizontal = 1;
    }

    if (movement.Vertical != 0 || movement.Horizontal != 0) {
      input.PercentSpeed = 1;
      if (movement.Vertical == -1) {
        if (movement.Horizontal == -1) { // 7
          input.Angle = Math.PI + Math.PI/4;
        } else if (movement.Horizontal == 0) { // 8
          input.Angle = Math.PI + Math.PI / 2;
        } else { // 9
          input.Angle = Math.PI + Math.PI * 3 / 4;
        }
      } else if (movement.Vertical == 0) {
        if (movement.Horizontal == -1) { // 4
          input.Angle = Math.PI;
        } else { // 6
          input.Angle = 0;
        }
      } else if (movement.Vertical == 1) {
        if (movement.Horizontal == -1) { // 1
          input.Angle = Math.PI * 3 / 4;
        } else if (movement.Horizontal == 0) { // 2
          input.Angle = Math.PI / 2;
        } else { // 3
          input.Angle = Math.PI / 4;
        }
      }
    } else {
      input.PercentSpeed = 0;
    }

    // Read joystick input
    if (this.joystick && movement.Vertical == 0 && movement.Horizontal == 0) {
      //var cursorKeys = this.joystick.createCursorKeys();
      
      let degrees = (this.joystick.angle + 360) % 360;
      let radians = degrees * Math.PI/180;
      input.Angle = radians;

      input.PercentSpeed = Math.min(this.joystick.force, 70) / 70;
    }

    // Fire bullets
    if (this.keys.SPACE.isDown) {
      this.spaceWasDown = true;
    } else if (this.keys.SPACE.isUp && this.spaceWasDown) {
      input.Shot = this.currentWeapon;
      this.spaceWasDown = false;
    }

    if (this.mouseFire) {
      input.Shot = this.currentWeapon;
      this.mouseFire = false;
    }

    // Change weapon
    if (this.keys.ONE.isDown) {
      this.oneWasDown = true;
    } else if (this.keys.ONE.isUp && this.oneWasDown) {
      this.changeWeapon(ShotType.Plain);
      this.oneWasDown = false;
    }

    if (this.keys.TWO.isDown) {
      this.twoWasDown = true;
    } else if (this.keys.TWO.isUp && this.twoWasDown) {
      this.changeWeapon(ShotType.BigSlow);
      this.twoWasDown = false;
    }

    // Update angle based on the mouse line.
    input.AimAngle = this.mouseAimAngle;

    return input;
  }

  rollbackDebugText;

  create() {
    var self = this;

    this.vsAI = this.game.MatchStartOptions.vsAI;

    // This is the peer server deployed as a standalone app.
    // const hostInfo = {
    //   secure: true,
    //   port: 443,
    //   host: 'victari-peer.herokuapp.com',
    // };

    // This runs peer on the main server.
    const hostInfo = {
      secure: true,
      port: 443,
      host: 'victari-pewpew.herokuapp.com',
      path: '/peerjs'
    };

    self.peerId = uuidv4();
    self.peer = new Peer(self.peerId, hostInfo);
    self.peer.on('error', (error) => {
      console.error('ERROR: ' + error);
    });
    self.peer.on('connection', (conn) => {
      self.connection = conn;
      self.connection.on('data', (data) => {
        self.handleRemoteData(data);
      });
      self.connection.on('open', () => {
        // Setup and and start the match.
        self.startMatch();
      });
    });
    this.rollbackDebugText = this.add.text(700, 200, '');

    this.input.addPointer(1);

    // Joystick graphics object
    if (mobileAndTabletCheck()) {
      let base = this.add.circle(0, 0, 75, 0x888888, 0.75);
      this.joystick = new VirtualJoyStick(this, {
        x: Constants.PlayAreaBufferX + 50,
        y: Constants.PlayAreaBufferY + Constants.PlayAreaHeight - 50,
        radius: 75,
        base: base,
        thumb: this.add.circle(0, 0, 25, 0xcccccc, 0.75),
        // dir: '8dir',   // 'up&down'|0|'left&right'|1|'4dir'|2|'8dir'|3
        // forceMin: 16,
        // enable: true
      });
      base.on('pointerdown', (pointer, localX, localY, event) => {
        self.joystickJustPressed = true;
        //event.stopPropogation();
      }).on('pointerup', (pointer, localX, localY, event) => {
        //event.stopPropogation();
      });
    }

    self.game.socketManager.setCurrentScene(this);

    this.onlineInfoText = this.add.text(Constants.PlayAreaBufferX+Constants.PlayAreaWidth + 5, 100,
      '', { 
      color: 'white',
      fontSize: '24px',
      wordWrap: { width: 200, useAdvancedWrap: true }
    }).setOrigin(0, 0);

    this.latencyText = this.add.text(Constants.PlayAreaWidth + 120, 10,
      'Latency: 0', { 
      color: 'white',
      fontSize: '24px',
    }).setOrigin(0, 0);

    this.accumulatedTime = 0;
    this.bulletGraphics = [];

    var config = {
      key: 'explodeAnimation',
      frames: this.anims.generateFrameNumbers('explosion', { start: 0, end: 63, first: 0 }),
      frameRate: 30,
      hideOnComplete: true,
    };

    this.inputState = InputState.WaitingToJoinGame;
    this.waitingForPlayerText = this.add.text(
      Constants.PlayAreaBufferX + Constants.PlayAreaWidth/2,
      Constants.PlayAreaBufferY + Constants.PlayAreaHeight/2,
      'Waiting for player...', { 
      color: 'white',
      fontSize: '74px',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0.5);

    this.fpsText = new FpsText(this)

    let textX = Constants.PlayAreaBufferX + Constants.PlayAreaWidth/2;
    let textY = Constants.PlayAreaBufferY;

    this.weaponSelectionText = this.add.text(textX, textY-50, '', { 
      color: 'white',
      fontSize: '24px',
    }).setOrigin(0.5, 0.5);

    this.gameOverText = this.add.text(textX, textY + Constants.PlayAreaHeight/2, '', { 
      color: 'white',
      fontSize: '78px',
    }).setOrigin(0.5, 0.5);
    this.gameOverText.setDepth(Depth_UI);

    this.leaveGameButton = new TextButton(this, 
      Constants.PlayAreaBufferX + Constants.PlayAreaWidth + 20, Constants.PlayAreaBufferY +Constants.PlayAreaHeight - 50,
      'Quit', () => {
      self.returnToMainMenu();
    }, false, null);

    this.add.text(Constants.PlayAreaBufferX + Constants.PlayAreaWidth + 80, Constants.PlayAreaBufferY, 'Weapon:', { 
      color: 'white',
      fontSize: '34px',
    }).setOrigin(0.5, 0);
    let weaponYOffset = 150;
    this.weaponSelectbuttons = [];
    for (var i = ShotType.Plain; i <= ShotType.BigSlow; i++) {
      let weapon = new TextButton(this, 
        Constants.PlayAreaBufferX + Constants.PlayAreaWidth + 85, Constants.PlayAreaBufferY + 125 + weaponYOffset * (i - ShotType.Plain),
        '' + (i - 1), 
        (param) => {
          self.changeWeapon(param);
          self.mouseDown = false;
      }, true, i);
      this.weaponSelectbuttons.push(weapon);
    }


    this.playArea = this.add.rectangle(Constants.PlayAreaBufferX, Constants.PlayAreaBufferY, 
      Constants.PlayAreaWidth, Constants.PlayAreaHeight, 0xFF0000, 0);
    this.playArea.setStrokeStyle(3, 0xFF0000, 1.0);
    this.playArea.setOrigin(0, 0);

    this.noMansZone = this.add.rectangle(NoMansZoneX, Constants.PlayAreaBufferY,
      NoMansZoneWidth, Constants.PlayAreaHeight, 0, 0);
    this.noMansZone.setStrokeStyle(3, NoMansZoneColor, 1.0);
    this.noMansZone.setOrigin(0, 0);

    this.keys = this.input.keyboard.addKeys('W,S,A,D,SPACE,I,J,K,L,P,M,N,ONE,TWO', false);

    let player1InfoX = Constants.PlayAreaBufferX;
    let player2InfoX = Constants.PlayAreaBufferX + Constants.PlayAreaWidth/2;

    let nameY = Constants.PlayAreaBufferY-75;
    this.player1NameText = this.add.text(player1InfoX, nameY,
      '', {
      color: 'white',
      fontSize: '34px',
    }).setOrigin(0, 0);

    this.player2NameText = this.add.text(player2InfoX, nameY,
      '', { 
      color: 'white',
      fontSize: '34px',
    }).setOrigin(0, 0);

    this.playerHealthIndicator = new EnergyBar(this, player1InfoX, textY-30, 0x00FF00);
    this.playerEnergyIndicator = new EnergyBar(this, this.playerHealthIndicator.x + 250, textY-30, 0x29B6F6);

    this.enemyHealthIndicator = new EnergyBar(this, player2InfoX, textY-30, 0x00FF00);
    this.enemyEnergyIndicator = new EnergyBar(this, this.enemyHealthIndicator.x + 250, textY-30, 0x29B6F6);
    
    this.playerEnergyIndicator.updateFillPercent(0);
    this.enemyEnergyIndicator.updateFillPercent(0);

    // Create the mouse line
    this.mouseAimLine = this.add.line(0, 0, 0, 0, 0, 0, 0x00FF00, 0.0);

    this.input.on('pointerdown', (pointer, localX, localY, event) => {
      if (self.joystickJustPressed) {
        self.joystickJustPressed = false;
      } else {
        self.onMouseDown(pointer, localX, localY, event);
      }
    });

    this.input.on('pointerup', (pointer, localX, localY, event) => {
      self.onMouseUp(pointer, localX, localY, event);
    });

    if (this.vsAI) {
      this.aiPlayer = new SimpleAI(this);
      this.startAIMatch();
    } else {
      // Automatically join game
      this.game.socketManager.emit('joingame', {
          PeerId: self.peerId,
      });
    }
  }

  returnToMainMenu() {
    this.game.socketManager.emit('leavegame');
    this.cleanup();
    this.scene.start('MainMenuScene');

  }

  exitPeerToPeerConnection() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.peer) {
      this.peer.disconnect();
      this.peer.destroy();
    }
    this.connection = null;
    if (this.rollbackNetcode) {
      this.rollbackNetcode.stop();
      this.rollbackNetcode = null;
    }
  }

  cleanup() {
    if (this.aiPlayer) {
      this.aiPlayer.stop();
    }
    this.exitPeerToPeerConnection();
    this.game.socketManager.setCurrentScene(null);
    this.host = false;
    this.mouseDown = false;
    this.mouseFire = false;
  }
  
  beginOnlineGame(startGameMessage) {
    var self = this;

    // Only the host gets this message
    // Start up the peer connection.
    self.host = true;
    self.opponentPeerId = startGameMessage.opponentPeerId;

    self.connection = self.peer!.connect(self.opponentPeerId);
    if (self.connection) {
      self.connection.on('error', (error) => {
        console.error('ERROR: ' + error);
      });
      self.connection.on('data', (data) => {
        self.handleRemoteData(data);
      });
      self.connection.on('open', () => {
        // Setup and and start the match.
        self.startMatch();
      });
    } else {
      console.error('Peer.connect failed to make connection');
    }
  }

  startAIMatch() {
    this.host = true;
    this.connection = null;
    this.startMatch();
    this.aiPlayer.startMatch();
    this.setPlayerNames(this.game.socketManager.getPlayerName(), 'AI Bot');
  }

  setPlayerNames(p1name, p2name) {
    this.player1NameText.setText(p1name);
    this.player2NameText.setText(p2name);
  }

  beginNewGame() {
    this.inputState = InputState.Playing;
    this.waitingForPlayerText.setText('');
    this.changeWeapon(ShotType.Plain);

    this.joystickJustPressed = false;
    this.spaceWasDown  = false;
    this.oneWasDown  = false;
    this.twoWasDown  = false;
    this.pWasDown = false;

    // Cleanup previous state
    if (this.playerGraphic) {
      this.playerGraphic.destroy();
    }
    if (this.enemyGraphic) {
      this.enemyGraphic.destroy();
    }
    for (var i = 0 ; i < this.bulletGraphics.length; i++) {
      this.bulletGraphics[i].destroy();
    }
    this.bulletGraphics = [];

    this.gameOverText.setText('');

    // Create player
    this.playerGraphic = new CharacterGraphic(this, 1, PlayerColor, 1,
    );
    
    // Create enemy
    this.enemyGraphic = new CharacterGraphic(this, 2, EnemyColor, -1,
    );

    this.updateIndicators();
    this.updateCharacterPositionsFromSimulation();
  }

  joinGameResponse(success) {
    if (success) {
      //this.onlineInfoText.setText('Joined game successfully');
    } else {
      //this.onlineInfoText.setText('Failed to join game');
    }
  }

  startGame(message) {
    //this.onlineInfoText.setText('Game started! Side: ' + message.side);
    this.setPlayerNames(message.p1Name, message.p2Name);

    if (message.host) {
      this.beginOnlineGame(message);
    }
  }

  opponentLeft(message) {
    if (this.gameState) {
      let opponent = this.getOpponentPlayer();
      opponent.dead = true;
    }
  }

  preload() {
  }

  update(time, delta) {
    this.accumulatedTime += delta;
    if (this.accumulatedTime > Constants.Timestep) {

      if (this.aiPlayer) {
        this.aiPlayer.update();
      }

      this.fpsText.update()
      let text = 'Latency: ' + this.game.socketManager.getLatency();
      if (this.rollbackNetcode) {
        text += '\r\nPing: ' + this.pingMeasure.average().toFixed(2) +
        '\r\nStalling: ' + this.rollbackNetcode.shouldStall();
      }
      this.latencyText.setText(text);
      this.accumulatedTime -= Constants.Timestep;

      if (this.inputState == InputState.Playing) {

        //this.handlePlayerInput(timeIntoUpdate);


        // Update the health indicators
        this.updateIndicators();

        // Update the character positions and bullets
        this.updateCharacterPositionsFromSimulation();
        this.updateBulletPositionsFromSimulation();

        //this.updateMouse();


        this.checkGameoverState();

        if (this.showRollbackDebugText && this.rollbackNetcode) {
          this.rollbackDebugText.setText('Ping: ' + this.pingMeasure.average().toFixed(2) + 'ms\r\n' + 
            'History Size: ' + this.rollbackNetcode.history.length + '\r\n' + 
            'Frame Number: ' + this.rollbackNetcode.currentFrame() + '\r\n' + 
            'Largest Future Size: ' + this.rollbackNetcode.largestFutureSize() + '\r\n' + 
            'Predicated Frames: ' + this.rollbackNetcode.predictedFrames() + '\r\n' + 
            'Stalling: ' + this.rollbackNetcode.shouldStall()
          )
        }
      }
    }
  }

  getMyPlayerGraphic() {
    if (this.myPlayerSide == Player1SideLeft) {
      return this.playerGraphic;
    }
    return this.enemyGraphic;
  }

  updateMouse() {
    this.updateMouseLine(this.game.input.mousePointer);
  }

  updateMouseLine(pointer) {
    let mouseX = pointer.x;
    let mouseY = pointer.y;

    let myPlayer = this.getMyPlayerGraphic();

    let left = Constants.PlayAreaBufferX;
    let right = Constants.PlayAreaBufferX + Constants.PlayAreaWidth;
    let top = Constants.PlayAreaBufferY;
    let bottom = Constants.PlayAreaBufferY + Constants.PlayAreaHeight;

    // Check top
    let intersection = getLineIntersection(
      mouseX, mouseY, myPlayer.x, myPlayer.y,
      left, top, right, top
      );

    // Check bottom
    if (!intersection) {
      intersection = getLineIntersection(
        mouseX, mouseY, myPlayer.x, myPlayer.y,
        left, bottom, right, bottom
        );
    }
    
    // Check left
    if (!intersection) {
      intersection = getLineIntersection(
        mouseX, mouseY, myPlayer.x, myPlayer.y,
        left, top, left, bottom
        );
    }

    // Check right
    if (!intersection) {
      intersection = getLineIntersection(
        mouseX, mouseY, myPlayer.x, myPlayer.y,
        right, top, right, bottom
        );
    }

    let lineEndX = mouseX;
    let lineEndY = mouseY;
    if (intersection) {
      lineEndX = intersection.x;
      lineEndY = intersection.y;
    }
    
    this.mouseAimLine.setTo(lineEndX, lineEndY, myPlayer.x, myPlayer.y);

    // Calculate aim angle
    this.mouseAimAngle = Math.atan2(lineEndY - myPlayer.y, lineEndX - myPlayer.x);
  }

  onMouseDown(pointer, localX, localY, event) {
    if (this.inputState == InputState.Playing) {
      this.mouseDown = true;
    } else {
      this.mouseDown = false;
    }
  }

  onMouseUp(pointer, localX, localY, event) {
    if (this.mouseDown) {
      this.mouseFire = true;
      this.updateMouseLine(pointer);
      // Make sure we update the angle
    }
    this.mouseDown = false;
  }

  updateIndicators() {
    this.playerHealthIndicator.updateFillPercent(this.gameState.Player1.health / this.gameState.Player1.maxHealth);
    this.enemyHealthIndicator.updateFillPercent(this.gameState.Player2.health / this.gameState.Player2.maxHealth);

    this.playerEnergyIndicator.updateFillPercent(this.gameState.Player1.energy / this.gameState.Player1.maxEnergy);
    this.enemyEnergyIndicator.updateFillPercent(this.gameState.Player2.energy / this.gameState.Player2.maxEnergy);
  }

  getWeaponString() {
    if (this.currentWeapon == ShotType.Plain) {
      return 'Default';
    } else if (this.currentWeapon == ShotType.BigSlow) {
      return 'SlowShot';
    } else {
      return '???';
    }
  }

  updateCharacterPositionsFromSimulation() {
    this.playerGraphic.x = this.gameState.Player1.x + Constants.PlayAreaBufferX
    this.playerGraphic.y = this.gameState.Player1.y + Constants.PlayAreaBufferY

    this.enemyGraphic.x = this.gameState.Player2.x + Constants.PlayAreaBufferX
    this.enemyGraphic.y = this.gameState.Player2.y + Constants.PlayAreaBufferY
  }

  updateBulletPositionsFromSimulation() {

    for (var i = 0; i < this.gameState.Bullets.length; ++i) {
      // Find the corresponding graphical bullet and update it
      // If we didn't find it, create a new one.
      let bullet = this.gameState.Bullets[i];

      let found = false;

      for (var j = 0; j < this.bulletGraphics.length; ++j) {
        let graphicalBullet = this.bulletGraphics[j];
        if (bullet.id == graphicalBullet.id) {
          found = true;
          graphicalBullet.x = bullet.x + Constants.PlayAreaBufferX;
          graphicalBullet.y = bullet.y + Constants.PlayAreaBufferY;
          break;
        }
      }

      if (!found) {
        let newGraphicalBullet = new BulletGraphic(this, bullet);
        newGraphicalBullet.x = bullet.x + Constants.PlayAreaBufferX;
        newGraphicalBullet.y = bullet.y + Constants.PlayAreaBufferY;
        this.bulletGraphics.push(newGraphicalBullet);
      }
    }

    //
    // Go through all the graphicsbullets.
    // If you don't find a matching bullet in the world state
    // then it has been removed. Delete it!
    //
    for (var j = this.bulletGraphics.length - 1; j >= 0; --j) {
      let graphicalBullet = this.bulletGraphics[j];
      let foundBullet = false;
      for (var i = 0; i < this.gameState.Bullets.length; ++i) {
        let simBullet = this.gameState.Bullets[i];
        if (simBullet.id == graphicalBullet.id) {
          foundBullet = true;
          break;
        }
      }

      if (!foundBullet) {
        graphicalBullet.destroy();
        this.bulletGraphics.splice(j, 1);
      }
    }
  }

  getMyPlayer() {
    if (this.myPlayerSide == Player1SideLeft) {
      return this.gameState.Player1;
    }
    return this.gameState.Player2;
  }

  getOpponentPlayer() {
    if (this.myPlayerSide == Player1SideLeft) {
      return this.gameState.Player2;
    }
    return this.gameState.Player1;
  }

  changeWeapon(newWeapon : number) {
    this.currentWeapon = newWeapon;
    if (ShotDefinitions[this.currentWeapon].MouseAim) {
      this.mouseAimLine.setAlpha(1);
    } else {
      this.mouseAimLine.setAlpha(0);
    }

    // Update the button so it looks highlighted.
    for (var i = 0; i < this.weaponSelectbuttons.length; i++) {
      let button = this.weaponSelectbuttons[i];
      let shotType = ShotType.None;
      if (i == 0) {
        shotType = ShotType.Plain;
      } else {
        shotType = ShotType.BigSlow;
      }

      if (shotType == newWeapon) {
        // This button is the selected weapon.
        button.setEnabled(false);
      } else {
        // This button is not selected.
        button.setEnabled(true);
      }
    }
  }

  debugInput() {
    // if (this.keys.M.isDown) {
    //   this.mWasDown = true;
    // } else if (this.keys.M.isUp && this.mWasDown) {

    //   // Start or stop recording.
    //   this.simulation.toggleRecording();

    //   this.mWasDown = false;
    // }

    // if (this.keys.N.isDown) {
    //   this.nWasDown = true;
    // } else if (this.keys.N.isUp && this.nWasDown) {
    //   this.simulation.enableReplay();
    //   this.nWasDown = false;
    // }
  }

  checkGameoverState() {
    if (this.gameState.Player1.dead || this.gameState.Player2.dead) {
      if (this.gameState.Player1.dead && this.gameState.Player2.dead) {
        // Draw
        this.gameOverText.setText('Draw');
        this.reportMatchResult(ReportResult.Draw);
      } else {
        if (this.gameState.Player1.dead) {
          this.reportMatchResult(ReportResult.P1Win);
        } else {
          this.reportMatchResult(ReportResult.P2Win);
        }

        let myPlayer = this.getMyPlayer();
        let youLose = myPlayer.dead;
        if (youLose) {
          this.gameOverText.setText('YOU LOSE');
        } else {
          this.gameOverText.setText('YOU WIN');
        }
      }

      this.inputState = InputState.GameOver;
      this.exitPeerToPeerConnection();
    }
  }
  
  reportMatchResult(result) {
    if (this.vsAI) {
      this.aiPlayer.stop();
    } else {
      this.game.socketManager.emit('reportresult', {
        Result: result,
      });
    }
  }
}


// line intercept math by Paul Bourke http://paulbourke.net/geometry/pointlineplane/
// Determine the intersection point of two line segments
// Return FALSE if the lines don't intersect
function getLineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {

  // Check if none of the lines are of length 0
	if ((x1 === x2 && y1 === y2) || (x3 === x4 && y3 === y4)) {
		return false
	}

	let denominator = ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1))

  // Lines are parallel
	if (denominator === 0) {
		return false
	}

	let ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator
	let ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator

  // is the intersection along the segments
	if (ua < 0 || ua > 1 || ub < 0 || ub > 1) {
		return false
	}

  // Return a object with the x and y coordinates of the intersection
	let x = x1 + ua * (x2 - x1)
	let y = y1 + ua * (y2 - y1)

	return {x, y}
}

 function mobileCheck() {
  let check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor);
  return check;
};

function mobileAndTabletCheck() {
  let check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor);
  return check;
};