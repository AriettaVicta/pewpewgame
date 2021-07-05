import FpsText from '../objects/fpsText'
import TextButton from '../objects/textbutton';
import Constants from '../contants';
import Bullet from '../objects/bullet';
import {ShotType} from '../enums';
import Character from '../objects/character';
import { CharacterInput } from '../interfaces';
import HealthIndicator from '../objects/healthindicator';
import Simulation from '../simulation/simulation';
import EnergyIndicator from '../objects/energyindicator';
import { io, Socket } from "socket.io-client";

const TargetFrameTime = 16.6666;

const PlayerStartX = Constants.PlayAreaBufferX + Constants.PlayAreaWidth / 4;
const PlayerStartY = Constants.PlayAreaBufferY + Constants.PlayAreaHeight / 2;

const EnemyStartX = Constants.PlayAreaBufferX + Constants.PlayAreaWidth / 4 + Constants.PlayAreaWidth/2;
const EnemyStartY = Constants.PlayAreaBufferY + Constants.PlayAreaHeight / 2;


const PlayerColor = 0x1fe5ff;
const EnemyColor = 0xff0090;

const NoMansZoneWidth = 40;
const NoMansZoneX = Constants.PlayAreaBufferX + Constants.PlayAreaWidth / 2 - NoMansZoneWidth/2;
const NoMansZoneColor = 0xFF0000;

const Depth_UI = 1000;

enum InputState {
  Default,
  GameOver,
}


export default class MainScene extends Phaser.Scene {
  fpsText: FpsText;
  elapsedTime;
  instructionText : Phaser.GameObjects.Text;
  instructionText2 : Phaser.GameObjects.Text;
  gameOverText : Phaser.GameObjects.Text;
  inputState;
  keys;
  playArea : Phaser.GameObjects.Rectangle;
  noMansZone : Phaser.GameObjects.Rectangle;
  accumulatedTime : number;

  player : Character;
  enemy : Character;
  playerHealthIndicator : HealthIndicator;
  enemyHealthIndicator : HealthIndicator;
  playerEnergyIndicator : EnergyIndicator;
  enemyEnergyIndicator : EnergyIndicator;

  spaceWasDown : boolean;
  pWasDown : boolean;
  mWasDown : boolean;
  nWasDown : boolean;
  oneWasDown: boolean;
  bullets : Bullet[];

  simulation : Simulation;

  newGameButton : TextButton;

  socket : Socket;

  constructor() {
    super({ key: 'MainScene' })
  }

  create() {
    var self = this;

    this.socket = io();
    this.socket.connect();
    this.socket.on('ack', (param) => {
      console.log('received ack: ' + param)
    });
    this.socket.emit('hello');

    this.accumulatedTime = 0;
    this.bullets = [];

    this.simulation = new Simulation();

    var config = {
      key: 'explodeAnimation',
      frames: this.anims.generateFrameNumbers('explosion', { start: 0, end: 63, first: 0 }),
      frameRate: 30,
      hideOnComplete: true,
    };

    this.inputState = InputState.Default;

    this.fpsText = new FpsText(this)

    let textX = Constants.PlayAreaBufferX + Constants.PlayAreaWidth/2;
    let textY = Constants.PlayAreaBufferY;

    this.instructionText = this.add.text(textX, textY-90, 'PEW PEW GAME', { 
      color: 'white',
      fontSize: '30px',
      fontStyle: 'bold',
    }).setOrigin(0.5,0.5);

    this.instructionText2 = this.add.text(textX, textY-50, '(WSAD/Arrow keys to move)', { 
      color: 'white',
      fontSize: '24px',
    }).setOrigin(0.5, 0.5);

    this.gameOverText = this.add.text(textX, textY + Constants.PlayAreaHeight/2, '', { 
      color: 'white',
      fontSize: '78px',
    }).setOrigin(0.5, 0.5);
    this.gameOverText.setDepth(Depth_UI);

    this.newGameButton = new TextButton(this, textX +350, textY-80, 'New Game', () => {
      self.beginNewGame();
    });

    this.playArea = this.add.rectangle(Constants.PlayAreaBufferX, Constants.PlayAreaBufferY, 
      Constants.PlayAreaWidth, Constants.PlayAreaHeight, 0xFF0000, 0);
    this.playArea.setStrokeStyle(3, 0xFF0000, 1.0);
    this.playArea.setOrigin(0, 0);

    this.noMansZone = this.add.rectangle(NoMansZoneX, Constants.PlayAreaBufferY,
      NoMansZoneWidth, Constants.PlayAreaHeight, 0, 0);
    this.noMansZone.setStrokeStyle(3, NoMansZoneColor, 1.0);
    this.noMansZone.setOrigin(0, 0);

    this.keys = this.input.keyboard.addKeys('W,S,A,D,SPACE,I,J,K,L,P,M,N,ONE');

      // TODO: Add key up handler
      // scene.input.keyboard.on('keyup', function (eventName, event) { /* ... */ });

    // Create health bars
    this.playerHealthIndicator = new HealthIndicator(this, Constants.PlayAreaBufferX, textY-30);
    this.enemyHealthIndicator = new HealthIndicator(this, Constants.PlayAreaBufferX + Constants.PlayAreaWidth, textY-30);
    this.enemyHealthIndicator.setOrigin(1, 0);
    
    // Create energy bars
    this.playerEnergyIndicator = new EnergyIndicator(this, Constants.PlayAreaBufferX + 250, textY-30);
    this.enemyEnergyIndicator = new EnergyIndicator(this, Constants.PlayAreaBufferX + Constants.PlayAreaWidth - 450, textY-30);

    this.beginNewGame();
  }
  
  beginNewGame() {
    this.inputState = InputState.Default;

    // Cleanup previous state
    if (this.player) {
      this.player.destroy();
    }
    if (this.enemy) {
      this.enemy.destroy();
    }
    for (var i = 0 ; i < this.bullets.length; i++) {
      this.bullets[i].destroy();
    }
    this.bullets = [];

    this.spaceWasDown = false;
    this.pWasDown = false;

    this.gameOverText.setText('');

    this.simulation.initialize(Constants.PlayAreaWidth, Constants.PlayAreaHeight);

    // Create player
    this.player = new Character(this, 1, PlayerColor, 1,
    );
    
    // Create enemy
    this.enemy = new Character(this, 2, EnemyColor, -1,
    );

    this.updateIndicators();

    this.updateCharacterPositionsFromSimulation();
  }

  preload() {
  }

  update(time, delta) {
    this.accumulatedTime += delta;
    if (this.accumulatedTime > TargetFrameTime) {

      this.fpsText.update()
      this.accumulatedTime -= TargetFrameTime;

      if (this.inputState == InputState.Default) {
        this.handlePlayerInput();
        this.handleEnemyInput();
        this.debugInput();

        // Send input to the simulation
        // Then update it.
        this.simulation.update();

        // Update the health indicators
        this.updateIndicators();
        this.playerHealthIndicator.update(this.simulation.p1.health);
        this.enemyHealthIndicator.update(this.simulation.p2.health);

        // Update the character positions and bullets
        this.updateCharacterPositionsFromSimulation();
        this.updateBulletPositionsFromSimulation();


        this.checkGameoverState();
      }
    }
  }

  updateIndicators() {
    this.playerHealthIndicator.update(this.simulation.p1.health);
    this.enemyHealthIndicator.update(this.simulation.p2.health);

    this.playerEnergyIndicator.update(this.simulation.p1.energy);
    this.enemyEnergyIndicator.update(this.simulation.p2.energy);
  }

  updateCharacterPositionsFromSimulation() {
    this.player.x = this.simulation.p1.x + Constants.PlayAreaBufferX;
    this.player.y = this.simulation.p1.y + Constants.PlayAreaBufferY;

    this.enemy.x = this.simulation.p2.x + Constants.PlayAreaBufferX;
    this.enemy.y = this.simulation.p2.y + Constants.PlayAreaBufferY;
  }

  updateBulletPositionsFromSimulation() {
    for (var i = 0; i < this.simulation.bullets.length; ++i) {
      // Find the corresponding graphical bullet and update it
      // If we didn't find it, create a new one.
      let simBullet = this.simulation.bullets[i];
      let found = false;
      for (var j = 0; j < this.bullets.length; ++j) {
        let graphicalBullet = this.bullets[j];
        if (simBullet.id == graphicalBullet.id) {
          // Update existing bullet
          found = true;
          graphicalBullet.updatePositionFromSimBullet(simBullet);
          break;
        }
      }

      if (!found) {
        // Create new bullet
        let newGraphicalBullet = new Bullet(this, simBullet);
        this.bullets.push(newGraphicalBullet);
      }
    }

    for (var i = 0; i < this.simulation.bulletIdsRemoved.length; ++i) {
      // Find the corresponding graphical bullet and delete it.
      let removedId = this.simulation.bulletIdsRemoved[i];
      for (var j = this.bullets.length - 1; j >= 0; --j) {
        let graphicalBullet = this.bullets[j];
        if (graphicalBullet.id == removedId) {
          graphicalBullet.destroy();
          this.bullets.splice(j, 1);
        }
      }
    }
  }

  handlePlayerInput() {

    let characterInput : CharacterInput = {
      OwnerId: 1,
      VerticalMovement: 0,
      HorizontalMovement: 0,
      Shot: ShotType.None,
    };

    if (this.keys.W.isDown) {
      characterInput.VerticalMovement = -1;
    } else if (this.keys.S.isDown){
      characterInput.VerticalMovement = 1;
    }
    
    if (this.keys.A.isDown) {
      characterInput.HorizontalMovement = -1;
    } else if (this.keys.D.isDown){
      characterInput.HorizontalMovement = 1;
    }
    
    if (this.keys.SPACE.isDown) {
      this.spaceWasDown = true;
    } else if (this.keys.SPACE.isUp && this.spaceWasDown) {
      characterInput.Shot = ShotType.Plain;
      this.spaceWasDown = false;

      this.socket.emit('test');
    }

    if (this.keys.ONE.isDown) {
      this.oneWasDown = true;
    } else if (this.keys.ONE.isUp && this.oneWasDown) {
      characterInput.Shot = ShotType.BigSlow;
      this.oneWasDown = false;
    }

    this.simulation.submitInput(characterInput);
  }

  handleEnemyInput() {
    let characterInput : CharacterInput = {
      OwnerId: 2,
      VerticalMovement: 0,
      HorizontalMovement: 0,
      Shot: ShotType.None,
    };

    if (this.keys.I.isDown) {
      characterInput.VerticalMovement = -1;
    } else if (this.keys.K.isDown){
      characterInput.VerticalMovement = 1;
    }
    
    if (this.keys.J.isDown){
      characterInput.HorizontalMovement = -1;
    } else if (this.keys.L.isDown){
      characterInput.HorizontalMovement = 1;
    }
    
    if (this.keys.P.isDown) {
      this.pWasDown = true;
    }
    else if (this.keys.P.isUp && this.pWasDown) {
      characterInput.Shot = ShotType.Plain;
      this.pWasDown = false;
    }

    this.simulation.submitInput(characterInput);
  }

  debugInput() {
    if (this.keys.M.isDown) {
      this.mWasDown = true;
    } else if (this.keys.M.isUp && this.mWasDown) {

      // Start or stop recording.
      this.simulation.toggleRecording();

      this.mWasDown = false;
    }

    if (this.keys.N.isDown) {
      this.nWasDown = true;
    } else if (this.keys.N.isUp && this.nWasDown) {
      this.simulation.enableReplay();
      this.nWasDown = false;
    }
  }

  checkGameoverState() {
    if (this.simulation.p1.dead || this.simulation.p2.dead) {

      if (this.simulation.p1.dead && this.simulation.p2.dead) {
        // Draw
        this.gameOverText.setText('Draw');
      } else if (this.simulation.p1.dead) {
        // Enemy wins
        this.gameOverText.setText('Enemy wins');
      } else {
        // Player wins
        this.gameOverText.setText('Player wins');
      }

      this.inputState = InputState.GameOver;
    }
  }
}

