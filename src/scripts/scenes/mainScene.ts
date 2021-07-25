import FpsText from '../objects/fpsText'
import TextButton from '../objects/textbutton';
import Constants from '../../shared/constants';
import BulletGraphic from '../objects/bulletgraphic';
import {ShotType} from '../../shared/enums';
import CharacterGraphic from '../objects/charactergraphic';
import { CharacterInput } from '../interfaces';
import HealthIndicator from '../objects/healthindicator';
import EnergyIndicator from '../objects/energyindicator';
import { io, Socket } from "socket.io-client";
import SimBullet from '../../shared/sim-bullet';
import ShotDefinitions from '../../shared/shotdefs';

const TargetFrameTime = 16.6666;

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


export default class MainScene extends Phaser.Scene {
  fpsText: FpsText;
  elapsedTime;
  instructionText : Phaser.GameObjects.Text;
  weaponSelectionText : Phaser.GameObjects.Text;
  gameOverText : Phaser.GameObjects.Text;
  onlineInfoText : Phaser.GameObjects.Text;
  latencyText : Phaser.GameObjects.Text;
  inputState : InputState;
  keys;
  playArea : Phaser.GameObjects.Rectangle;
  noMansZone : Phaser.GameObjects.Rectangle;
  accumulatedTime : number;

  mouseAimLine : Phaser.GameObjects.Line;
  mouseAimAngle : number;

  playerGraphic : CharacterGraphic;
  enemyGraphic : CharacterGraphic;
  playerHealthIndicator : HealthIndicator;
  enemyHealthIndicator : HealthIndicator;
  playerEnergyIndicator : EnergyIndicator;
  enemyEnergyIndicator : EnergyIndicator;

  spaceWasDown : boolean;
  pWasDown : boolean;
  mWasDown : boolean;
  nWasDown : boolean;
  oneWasDown: boolean;
  twoWasDown : boolean;
  mouseDown : boolean;
  bulletGraphics : BulletGraphic[];

  newGameButton : TextButton;
  joinGameButton : TextButton;

  sentMessage;
  pingstart;

  socket : Socket;

  side : number;

  lastInput : CharacterInput | any;

  previousWorldState;
  previousWorldStateTimestamp : number;
  latestWorldState;
  latestWorldStateTimestamp : number;


  currentWeapon : number;

  constructor() {
    super({ key: 'MainScene' })
  }

  create() {
    var self = this;

    this.onlineInfoText = this.add.text(Constants.PlayAreaBufferX+Constants.PlayAreaWidth + 5, 100,
      'Disconnected', { 
      color: 'white',
      fontSize: '24px',
      wordWrap: { width: 200, useAdvancedWrap: true }
    }).setOrigin(0, 0);

    this.latencyText = this.add.text(Constants.PlayAreaWidth + 5, 20,
      'Latency: 0', { 
      color: 'white',
      fontSize: '24px',
    }).setOrigin(0, 0);

    this.socket = io();
    this.socket.connect();
    this.socket.on("joingameresponse", (success) => {
      var time = Date.now() - self.sentMessage;
      console.log('response in: ' + time);
      if (success) {
        self.onlineInfoText.setText('Joined game successfully');
      } else {
        self.onlineInfoText.setText('Failed to join game');
      }
    });
    this.socket.on('startgame', (message) => {
      self.onlineInfoText.setText('Game started! Side: ' + message.side);
      self.beginOnlineGame(message);
    });
    this.socket.on('worldupdate', (worldState) => {
      self.processWorldUpdate(worldState);
    })

    this.socket.on('pong', () => {
      const latency = Date.now() - self.pingstart;
      self.latencyText.setText('Latency: ' + latency);
    });

    setInterval(() => {
      self.pingstart = Date.now();
      // volatile, so the packet will be discarded if the socket is not connected
      self.socket.volatile.emit("ping");
    }, 2000); 


    this.accumulatedTime = 0;
    this.bulletGraphics = [];

    var config = {
      key: 'explodeAnimation',
      frames: this.anims.generateFrameNumbers('explosion', { start: 0, end: 63, first: 0 }),
      frameRate: 30,
      hideOnComplete: true,
    };

    this.inputState = InputState.WaitingToJoinGame;

    this.fpsText = new FpsText(this)

    let textX = Constants.PlayAreaBufferX + Constants.PlayAreaWidth/2;
    let textY = Constants.PlayAreaBufferY;

    this.instructionText = this.add.text(textX, textY-90, 'PEW PEW GAME', { 
      color: 'white',
      fontSize: '30px',
      fontStyle: 'bold',
    }).setOrigin(0.5,0.5);

    this.weaponSelectionText = this.add.text(textX, textY-50, 'Weapon:', { 
      color: 'white',
      fontSize: '24px',
    }).setOrigin(0.5, 0.5);

    this.gameOverText = this.add.text(textX, textY + Constants.PlayAreaHeight/2, '', { 
      color: 'white',
      fontSize: '78px',
    }).setOrigin(0.5, 0.5);
    this.gameOverText.setDepth(Depth_UI);

    // this.newGameButton = new TextButton(this, textX +350, textY-80, 'New Game', () => {
    //   self.beginNewGame(1);
    // });
    this.joinGameButton = new TextButton(this, textX +150, textY-80, 'Join Game', () => {
      self.sentMessage = Date.now();
      self.socket.emit('joingame');
    });

    this.playArea = this.add.rectangle(Constants.PlayAreaBufferX, Constants.PlayAreaBufferY, 
      Constants.PlayAreaWidth, Constants.PlayAreaHeight, 0xFF0000, 0);
    this.playArea.setStrokeStyle(3, 0xFF0000, 1.0);
    this.playArea.setOrigin(0, 0);

    this.noMansZone = this.add.rectangle(NoMansZoneX, Constants.PlayAreaBufferY,
      NoMansZoneWidth, Constants.PlayAreaHeight, 0, 0);
    this.noMansZone.setStrokeStyle(3, NoMansZoneColor, 1.0);
    this.noMansZone.setOrigin(0, 0);

    this.keys = this.input.keyboard.addKeys('W,S,A,D,SPACE,I,J,K,L,P,M,N,ONE,TWO');

      // TODO: Add key up handler
      // scene.input.keyboard.on('keyup', function (eventName, event) { /* ... */ });

    // Create health bars
    this.playerHealthIndicator = new HealthIndicator(this, Constants.PlayAreaBufferX, textY-30);
    this.enemyHealthIndicator = new HealthIndicator(this, Constants.PlayAreaBufferX + Constants.PlayAreaWidth, textY-30);
    this.enemyHealthIndicator.setOrigin(1, 0);
    
    // Create energy bars
    this.playerEnergyIndicator = new EnergyIndicator(this, Constants.PlayAreaBufferX + 250, textY-30);
    this.enemyEnergyIndicator = new EnergyIndicator(this, Constants.PlayAreaBufferX + Constants.PlayAreaWidth - 450, textY-30);

    // Create the mouse line
    this.mouseAimLine = this.add.line(0, 0, 0, 0, 0, 0, 0x00FF00, 1.0);

    this.input.on('pointerdown', () => {
      self.onMouseDown();
    });

    this.input.on('pointerup', () => {
      self.onMouseUp();
    });

    //this.beginNewGame(1);
  }
  
  beginOnlineGame(startGameMessage) {
    this.joinGameButton.setEnabled(false);
    this.beginNewGame(startGameMessage);
  }

  beginNewGame(startGameMessage) {
    this.inputState = InputState.Playing;

    this.side = startGameMessage.side;
    this.previousWorldState = startGameMessage.worldState;
    this.previousWorldStateTimestamp = Date.now();
    this.latestWorldState = this.previousWorldState;
    this.latestWorldStateTimestamp = this.previousWorldStateTimestamp;
    this.lastInput = null;
    this.changeWeapon(ShotType.Plain);

    this.spaceWasDown  = false;
    this.oneWasDown  = false;
    this.twoWasDown  = false;

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

    this.spaceWasDown = false;
    this.pWasDown = false;

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

  preload() {
  }

  update(time, delta) {
    this.accumulatedTime += delta;
    if (this.accumulatedTime > TargetFrameTime) {

      this.fpsText.update()
      this.accumulatedTime -= TargetFrameTime;

      if (this.inputState == InputState.Playing) {
        this.handlePlayerInput();

        // Update the health indicators
        this.updateIndicators();
        this.playerHealthIndicator.update(this.previousWorldState.p1.health);
        this.enemyHealthIndicator.update(this.previousWorldState.p2.health);

        // Update the character positions and bullets
        this.updateCharacterPositionsFromSimulation();
        this.updateBulletPositionsFromSimulation();

        this.updateMouse();


        this.checkGameoverState();
      }
    }
  }

  getMyPlayerGraphic() {
    if (this.side == 1) {
      return this.playerGraphic;
    }
    return this.enemyGraphic;
  }

  updateMouse() {
    let mouseX = this.game.input.mousePointer.x;
    let mouseY = this.game.input.mousePointer.y;

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

  onMouseDown() {
    if (this.inputState == InputState.Playing) {
      this.mouseDown = true;
    } else {
      this.mouseDown = false;
    }
  }

  onMouseUp() {
    this.mouseDown = false;
  }

  updateIndicators() {
    this.playerHealthIndicator.update(this.previousWorldState.p1.health);
    this.enemyHealthIndicator.update(this.previousWorldState.p2.health);

    this.playerEnergyIndicator.update(this.previousWorldState.p1.energy);
    this.enemyEnergyIndicator.update(this.previousWorldState.p2.energy);
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

    this.interpolateCharacterPosition(this.previousWorldState.p1, this.latestWorldState.p1, this.playerGraphic);
    this.interpolateCharacterPosition(this.previousWorldState.p2, this.latestWorldState.p2, this.enemyGraphic);

  }

  getElapsedTimeSincePreviousUpdate() {
    return (Date.now() - this.previousWorldStateTimestamp) - Constants.ServerUpdateMs;
  }

  getPercentElapsedTime() {
    let percent = this.getElapsedTimeSincePreviousUpdate() / Constants.ServerUpdateMs;
    if (percent > 1) percent = 1;

    return percent;
  }

  interpolateCharacterPosition(prevP1, latestP1, graphic) {
    let x1 = prevP1.x;
    let x2 = latestP1.x;
    let y1 = prevP1.y;
    let y2 = latestP1.y;

    let percent = this.getPercentElapsedTime();

    let x = ((x2 - x1) * percent) + x1;
    let y = ((y2 - y1) * percent) + y1;

    graphic.x = x + Constants.PlayAreaBufferX;
    graphic.y = y + Constants.PlayAreaBufferY;
  }

  getLatestStateForBullet(prevSimBullet : SimBullet) {
    for (var i = 0; i < this.latestWorldState.bullets.length; ++i) {
      let latestBullet = this.latestWorldState.bullets[i];
      if (prevSimBullet.id == latestBullet.id) {
        return latestBullet;
      }
    }

    return null;
  }

  updateBulletPositionsFromSimulation() {

    let elapsedTimeSincePrevious = this.getElapsedTimeSincePreviousUpdate();

    for (var i = 0; i < this.previousWorldState.bullets.length; ++i) {
      // Find the corresponding graphical bullet and update it
      // If we didn't find it, create a new one.
      let prevSimBullet = this.previousWorldState.bullets[i];
      let latestSimBullet = this.getLatestStateForBullet(prevSimBullet);

      if (latestSimBullet == null) {
        // Bullet disappears in next update.
        // Handled in the other loop below.
      } else {
        let found = false;

        let denominator = Constants.ServerUpdateMs;
        let dead = (latestSimBullet.deadAtTime != null);
        if (dead) {
          denominator = latestSimBullet.deadAtTime;
        }

        let percent = elapsedTimeSincePrevious / denominator;
        if (percent > 1 && dead) {
          // Delete bullet here.
          for (var j = 0; j < this.bulletGraphics.length; ++j) {
            let graphicalBullet = this.bulletGraphics[j];
            if (prevSimBullet.id == graphicalBullet.id) {
              graphicalBullet.destroy();
              this.bulletGraphics.splice(j, 1);
              break;
            }
          }
        } else {
          if (percent > 1) percent = 1;
          for (var j = 0; j < this.bulletGraphics.length; ++j) {
            let graphicalBullet = this.bulletGraphics[j];
            if (prevSimBullet.id == graphicalBullet.id) {
              // Update existing bullet
              found = true;
              graphicalBullet.interpolatePosition(prevSimBullet, latestSimBullet, percent);
              break;
            }
          }

          if (!found) {
            // Create new bullet
            let newGraphicalBullet = new BulletGraphic(this, prevSimBullet);
            newGraphicalBullet.interpolatePosition(prevSimBullet, latestSimBullet, percent);
            this.bulletGraphics.push(newGraphicalBullet);
          }
        }
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
      for (var i = 0; i < this.latestWorldState.bullets.length; ++i) {
        let simBullet = this.latestWorldState.bullets[i];
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

  processWorldUpdate(worldState) {

    this.lastInput = null;

    this.previousWorldState = this.latestWorldState;
    this.previousWorldStateTimestamp = this.latestWorldStateTimestamp;

    this.latestWorldState = worldState;
    this.latestWorldStateTimestamp = Date.now();

  }

  handlePlayerInput() {

    let timeSinceUpdate = Date.now() - this.latestWorldStateTimestamp;
    if (timeSinceUpdate < 0) timeSinceUpdate = 0;

    let characterInput : CharacterInput = {
      OwnerId: this.side,
      TimeSinceServerUpdate: timeSinceUpdate,

      VerticalMovement: 0,
      HorizontalMovement: 0,
      Shot: ShotType.None,
      AimAngle: 0,
    };

    // Movement
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
    
    // Fire bullets
    if (this.keys.SPACE.isDown) {
      this.spaceWasDown = true;
    } else if (this.keys.SPACE.isUp && this.spaceWasDown) {
      characterInput.Shot = this.currentWeapon;
      this.spaceWasDown = false;
    }

    if (this.mouseDown) {
      characterInput.Shot = this.currentWeapon;
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
    characterInput.AimAngle = this.mouseAimAngle;

    // Check if input has changed since last frame.
    let inputHasChanged = true;
    if (this.lastInput) {
      if (characterInput.HorizontalMovement == this.lastInput.HorizontalMovement &&
        characterInput.VerticalMovement == this.lastInput.VerticalMovement &&
        characterInput.Shot == this.lastInput.Shot
        ) {
        inputHasChanged = false;
      }
    }

    if (characterInput.Shot != ShotType.None) {
      inputHasChanged = true;
    }

    this.lastInput = characterInput;

    if (inputHasChanged) {
      this.socket.emit('sendinput', characterInput);
    }
  }

  changeWeapon(newWeapon : number) {
    this.currentWeapon = newWeapon;
    if (ShotDefinitions[this.currentWeapon].MouseAim) {
      this.mouseAimLine.setAlpha(1);
    } else {
      this.mouseAimLine.setAlpha(0);
    }

    this.weaponSelectionText.setText('Weapon: ' + this.getWeaponString());
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
    if (this.latestWorldState.p1.dead || this.latestWorldState.p2.dead) {

      if (this.latestWorldState.p1.dead && this.latestWorldState.p2.dead) {
        // Draw
        this.gameOverText.setText('Draw');
      } else if (this.latestWorldState.p1.dead) {
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
