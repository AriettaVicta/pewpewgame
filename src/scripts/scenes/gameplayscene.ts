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
      this.connection!.send({ type: "ping-resp", sent_time: data.sent_time });
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
        self.connection!.send({ type: "input", frame: frame, input: input.serialize() });
      },
      (frame, state) => { // broadcast state
        self.connection!.send({ type: "state", frame: frame, state: state });
      }
    )

    this.pingInterval = global.setInterval(() => {
      self.connection!.send({ type: "ping-req", sent_time: Date.now() });
    }, PING_INTERVAL);

    this.rollbackNetcode!.start();
  }

  getInput() : GameInput {
    let input = new GameInput();

    // Read joystick input
    var cursorKeys = this.joystick.createCursorKeys();
    if (cursorKeys['up'].isDown) {
      input.VerticalMovement = -1;
    }
    if (cursorKeys['right'].isDown) {
      input.HorizontalMovement = 1;
    }
    if (cursorKeys['left'].isDown) {
      input.HorizontalMovement = -1;
    }
    if (cursorKeys['down'].isDown) {
      input.VerticalMovement = 1;
    }

    // Movement
    if (this.keys.W.isDown) {
      input.VerticalMovement = -1;
    } else if (this.keys.S.isDown){
      input.VerticalMovement = 1;
    }

    if (this.keys.A.isDown) {
      input.HorizontalMovement = -1;
    } else if (this.keys.D.isDown){
      input.HorizontalMovement = 1;
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

    this.rollbackDebugText = this.add.text(700, 200, '');

    const hostInfo = {
      secure: true,
      port: 443,
      host: 'victari-pewpew.herokuapp.com/',
      path: '/peerjs'
    };

    self.peerId = uuidv4();
    self.peer = new Peer(self.peerId, hostInfo);
    self.peer.on('error', (error) => {
      console.error('ERROR: ' + error);
    });
    self.peer.on('connection', (conn) => {
      console.log('new connection');
      self.connection = conn;
      self.connection.on('data', (data) => {
        self.handleRemoteData(data);
      });
      self.connection.on('open', () => {
        // Setup and and start the match.
        console.log('startmatch on new connection open');
        self.startMatch();
      });
    });

    this.input.addPointer(1);

    // Joystick graphics object
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
      //event.stopPropogation();
    }).on('pointerup', (pointer, localX, localY, event) => {
      //event.stopPropogation();
    });

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
    let weaponYOffset = 120;
    this.weaponSelectbuttons = [];
    for (var i = ShotType.Plain; i <= ShotType.BigSlow; i++) {
      let weapon = new TextButton(this, 
        Constants.PlayAreaBufferX + Constants.PlayAreaWidth + 75, Constants.PlayAreaBufferY + 125 + weaponYOffset * (i - ShotType.Plain),
        '' + (i - 1), 
        (param) => {
          self.changeWeapon(param);
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

    this.keys = this.input.keyboard.addKeys('W,S,A,D,SPACE,I,J,K,L,P,M,N,ONE,TWO');

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
      self.onMouseDown(pointer, localX, localY, event);
    });

    this.input.on('pointerup', (pointer, localX, localY, event) => {
      self.onMouseUp(pointer, localX, localY, event);
    });

    // Automatically join game
    this.game.socketManager.emit('joingame', {
        PeerId: self.peerId,
    });
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
    this.exitPeerToPeerConnection();
    this.game.socketManager.setCurrentScene(null);
    this.host = false;
    this.mouseDown = false;
  }
  
  beginOnlineGame(startGameMessage) {
    var self = this;

    // Only the host gets this message
    // Start up the peer connection.
    self.host = true;
    self.opponentPeerId = startGameMessage.opponentPeerId;

    console.log('beginning peer connect');

    self.connection = self.peer!.connect(self.opponentPeerId);
    if (self.connection) {
      self.connection.on('error', (error) => {
        console.log('ERROR: ' + error);
        console.error('ERROR: ' + error);
      });
      self.connection.on('data', (data) => {
        self.handleRemoteData(data);
      });
      self.connection.on('open', () => {
        // Setup and and start the match.
        console.log('host open connection');
        self.startMatch();
      });
    } else {
      console.log('Peer.connect failed to make connection');
    }
  }

  setPlayerNames(p1name, p2name) {
    this.player1NameText.setText(p1name);
    this.player2NameText.setText(p2name);
  }

  beginNewGame() {
    this.inputState = InputState.Playing;
    this.waitingForPlayerText.setText('');
    this.changeWeapon(ShotType.Plain);

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
    this.game.socketManager.emit('reportresult', {
      Result: result,
    });
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
