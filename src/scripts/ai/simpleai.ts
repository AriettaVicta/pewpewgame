import { NetplayPlayer } from "netplayjs";
import { Vector } from "ts-matrix";
import Constants from "../../shared/constants";
import { ShotType } from "../../shared/enums";
import { GameState } from "../gamestate/gamestate";
import { BulletState, GameInput, PlayerState } from "../gamestate/types";
import EWMASD from "../netcode/ewmasd";
import { RollbackNetcode } from "../netcode/rollback";

enum SeekBehavior {
  Player,
  Position,
}

enum ShootBehavior {
  Attack,
  Rest,
}

export default class SimpleAI {

  gameScene : Phaser.Scene | any;

  rollbackNetcode: RollbackNetcode<GameState, GameInput>;

  gameState: GameState;
  players : Array<NetplayPlayer>;
  pingMeasure: EWMASD = new EWMASD(0.2);
  host : boolean;

  seekBehavior : SeekBehavior;
  seekFrames : number = 0;
  seekPosition : Vector;

  shootBehavior : ShootBehavior = ShootBehavior.Attack;

  // Graphic stuff
  aheadLine : Phaser.GameObjects.Line;
  avoidLine : Phaser.GameObjects.Line;

  constructor(gameScene : Phaser.Scene) {
    this.gameScene = gameScene;
    this.host = false;

    this.aheadLine = gameScene.add.line(Constants.PlayAreaBufferX,Constants.PlayAreaBufferY,0,0,0,0, 0x00FF00, 1);
    this.aheadLine.setDepth(100);

    this.avoidLine = gameScene.add.line(Constants.PlayAreaBufferX,Constants.PlayAreaBufferY,0,0,0,0, 0xFFFF00, 1);
    this.avoidLine.setDepth(100);
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

    this.gameState = new GameState();
    this.players  = [
      new NetplayPlayer(0, false, true), // Player 0 is our peer, the host.
      new NetplayPlayer(1, true, false), // Player 1 is us, a client
    ];

    this.rollbackNetcode = new RollbackNetcode(
      false, // host
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

    this.rollbackNetcode!.start();
  }

  getInput() : GameInput {
    let input = new GameInput();

    //
    // Determine what the AI should be doing.
    //
    let me = this.gameState.Player2;
    let you = this.gameState.Player1;

    // 0.008 is like on the wall
    // 0.00001 is middle
    // Bullet, .06 is on top of you

    let resultantForce = new Vector([0,0]);


    let seekForce = this.getSeekBehaviorForce(me, you);
    resultantForce = resultantForce.add(seekForce);

    let avoidBulletForce = this.avoidBullets(me);
    const BulletScaleForce = 100;
    avoidBulletForce = avoidBulletForce.scale(BulletScaleForce);
    resultantForce = resultantForce.add(avoidBulletForce);

    let wallPos = new Vector([0, Constants.CharacterRadius]);
    let wallNorm = new Vector([0, 1]);
    let topWallForce = this.avoidWall(me, wallPos, wallNorm);
    wallPos = new Vector([Constants.PlayAreaWidth - Constants.CharacterRadius, 0]);
    wallNorm = new Vector([-1, 0]);
    let rightWallForce = this.avoidWall(me, wallPos, wallNorm);
    wallPos = new Vector([Constants.PlayAreaWidth/2 + Constants.NoMansZoneWidth/2 + Constants.CharacterRadius, 0]);
    wallNorm = new Vector([1, 0]);
    let leftWallForce = this.avoidWall(me, wallPos, wallNorm);
    wallPos = new Vector([0, Constants.PlayAreaHeight - Constants.CharacterRadius]);
    wallNorm = new Vector([0, -1]);
    let bottomWallForce = this.avoidWall(me, wallPos, wallNorm);

    const WallScaleForce = 1000;
    topWallForce = topWallForce.scale(WallScaleForce);
    rightWallForce = rightWallForce.scale(WallScaleForce);
    leftWallForce = leftWallForce.scale(WallScaleForce);
    bottomWallForce = bottomWallForce.scale(WallScaleForce);

    resultantForce = resultantForce.add(topWallForce);
    resultantForce = resultantForce.add(rightWallForce);
    resultantForce = resultantForce.add(leftWallForce);
    resultantForce = resultantForce.add(bottomWallForce);

    if (resultantForce.length() > 0.01) {
      input.Angle = Math.atan2(resultantForce.at(1), resultantForce.at(0));
      input.PercentSpeed = 1;
    }

    // Shoot
    this.handleShooting(me, you, input);

    return input;
  }

  handleShooting(me : PlayerState, you : PlayerState, input : GameInput) {
    if (this.shootBehavior == ShootBehavior.Attack) {
      let minDist = 10;
      if (this.seekBehavior == SeekBehavior.Player) {
        minDist = 20;
      }
      if (Math.abs(me.y - you.y) < minDist) {
        input.Shot = ShotType.VShot;
      }

      if (input.Shot == ShotType.None) {
        let leftBound = Constants.PlayAreaWidth / 2 + Constants.NoMansZoneWidth / 2;
        let halfway = (Constants.PlayAreaWidth - leftBound) / 2;
        if (me.x > leftBound + halfway && me.energy > 50) {
          input.Shot = ShotType.SpreadShot;
          input.AimAngle = (me.facingDirection == 1) ? 0 : Math.PI;
        } else {
          input.Shot = ShotType.BigSlow;
          let angleToYou = Math.atan2(you.y - me.y, you.x - me.x)
          let drift = ((Math.random() * 20)-10) * Math.PI / 180;
          input.AimAngle = angleToYou + drift;
        }

      }

      if (me.energy < 10) {
        this.shootBehavior = ShootBehavior.Rest;
      }
    } else if (this.shootBehavior == ShootBehavior.Rest) {
      if (me.energy > 90) {
        this.shootBehavior = ShootBehavior.Attack;
      }
    }
  }

  getSeekBehaviorForce(me : PlayerState, you : PlayerState) : Vector {
    if (this.seekFrames == 0) {
      this.pickNewSeekBehavior();
    }
    this.seekFrames--;

    if (this.seekBehavior == SeekBehavior.Player) {
      return this.seekPlayer(me, you);
    } else  if (this.seekBehavior == SeekBehavior.Position) {
      return this.seekLocation(me, this.seekPosition);
    } else {
      return new Vector([0,0]);
    }
  }

  pickNewSeekBehavior() {
    // Pick a new behavior.
    let rand = Math.floor(Math.random() * 5);
    if (rand == 0) {
      this.seekBehavior = SeekBehavior.Player;
    } else {
      this.seekBehavior = SeekBehavior.Position;

      let x = Constants.PlayAreaWidth/2 + Constants.NoMansZoneWidth/2 + 100;
      let y = 100;

      if (rand == 2 || rand == 3) x = Constants.PlayAreaWidth - 100;
      if (rand >3) y = Constants.PlayAreaHeight - 100;

      x += (Math.floor(Math.random() * 100) + 1) - 50
      y += (Math.floor(Math.random() * 100) + 1) - 50

      this.seekPosition = new Vector([x,y]);
    }

    const SEEK_BEHAVIOR_FRAME_DURATION = 180;
    this.seekFrames = SEEK_BEHAVIOR_FRAME_DURATION;
  }

  seekPlayer(me : PlayerState, you : PlayerState) : Vector {
    const PlayerSeekForceScale = 0.05;
    let seekPlayerVector = getSeekVector(me, you);
    let distanceToPlayer = seekPlayerVector.length();
    let seekPlayerForce = seekPlayerVector.scale((1 / (distanceToPlayer + 1)) * PlayerSeekForceScale);

    return seekPlayerForce;
  }

  seekLocation(me : PlayerState, loc : Vector) : Vector {
    const LocationSeekForceScale = 0.05;
    let obj = {x: loc.at(0), y: loc.at(1)}
    let seekVector = getSeekVector(me, obj);
    let distanceToLocation = seekVector.length();
    let seekForce = seekVector.scale((1 / (distanceToLocation + 1)) * LocationSeekForceScale);

    if (distanceToLocation < 5) {
      this.pickNewSeekBehavior();
    }

    return seekForce;
  }

  avoidBullets(me : PlayerState) : Vector {
    let closestBullet : BulletState | null = null;
    let distanceToClosest = 999999;
    for (var i = 0; i < this.gameState.Bullets.length; i++) {
      let bullet = this.gameState.Bullets[i];
      if (bullet.owner == me.id) continue;

      let distance = CalculateDistance(me, bullet);
      if (distance < distanceToClosest) {
        distanceToClosest = distance;
        closestBullet = bullet;
      }
    }

    const FEAR_DISTANCE = 75;
    const ANGLE_ADJUST = 10 * Math.PI/180;
    if (closestBullet != null && distanceToClosest < FEAR_DISTANCE) {
      let fleeAngle = getFleeAngle(me, closestBullet);

      // Modify angle if thi is a direct approach.
      let angleDiff = (closestBullet.angle - fleeAngle + Math.PI * 2) % (Math.PI * 2);
      if (angleDiff < ANGLE_ADJUST) {
        fleeAngle -= Math.PI/4;
      }
      // steering.Angle = fleeAngle;
      // steering.Magnitude = (1/ (distanceToClosest + 1))

      let fleeVector = new Vector([Math.cos(fleeAngle), Math.sin(fleeAngle)]);
      fleeVector = fleeVector.scale(1 / (distanceToClosest + 1));
      return fleeVector;
    }
    
    return new Vector([0,0]);
  }

  avoidWall(me : PlayerState, wallPosition : Vector, wallNormal : Vector) : Vector {
    let myPos = new Vector([me.x, me.y]);
    let distance = wallPosition.substract(myPos);
    distance = distance.multiply(wallNormal);

    const WALL_MIN_DISTANCE = 100;
    if (distance.length() < WALL_MIN_DISTANCE) {
      let inverseDistance = 1 / (distance.squaredLength() + 1);

      let force = new Vector(wallNormal.values);
      force = force.scale(inverseDistance);

      return force;
    }
    return new Vector([0,0]);
  }

  avoidBullets2(me : PlayerState, input) {

    // let dangerRating : Array<number> = [];
    // for (var i = 0; i < 9; i++) {
    //   dangerRating.push(0);
    // }

    // for (var i = 0; i < this.gameState.Bullets.length; i++) {
    //   let bullet = this.gameState.Bullets[i];
    //   if (bullet.owner == me.id) continue;

    //   let avoidanceRadius = me.radius * 1.5 + bullet.radius;
    //   let bulletPos = { 
    //     x: bullet.x, 
    //     y: bullet.y 
    //   };
    //   let aheadFrames = 100;
    //   let bulletAhead = { 
    //     x: bullet.x + Math.cos(bullet.angle) * aheadFrames * (bullet.speed / Constants.Timestep),
    //     y: bullet.y + Math.sin(bullet.angle) * aheadFrames * (bullet.speed / Constants.Timestep),
    //   };
    //   let bulletAheadHalf = { 
    //     x: bullet.x + Math.cos(bullet.angle) * aheadFrames * 0.5 * (bullet.speed / Constants.Timestep),
    //     y: bullet.y + Math.sin(bullet.angle) * aheadFrames * 0.5 * (bullet.speed / Constants.Timestep),
    //   };

    //   let d1 = distance(me, bulletPos);
    //   let d2 = distance(me, bulletAhead);
    //   let d3 = distance(me, bulletAheadHalf);
    //   if (d1 < avoidanceRadius ||
    //       d2 < avoidanceRadius ||
    //       d3 < avoidanceRadius) {
        
    //     // Consider this bullet since the look-ahead vector enters our sphere.

    //     for (var dangerIndex = 0; dangerIndex < dangerRating.length; dangerIndex++) {
    //       let nextPos = getPositionFromMove(me, dangerIndex + 1, 5);
    //       let farPos = getPositionFromMove(me, dangerIndex + 1, 30);
    //       let delta1 = distance(nextPos, bulletPos);
    //       let delta2 = distance(nextPos, bulletAhead);
    //       let delta3 = distance(nextPos, bulletAheadHalf);
    //       let far1 = distance(farPos, bulletPos);
    //       let far2 = distance(farPos, bulletPos);
    //       let far3 = distance(farPos, bulletPos);
    //       if (delta1 < avoidanceRadius) dangerRating[dangerIndex]+=10;
    //       if (delta2 < avoidanceRadius) dangerRating[dangerIndex]+=10;
    //       if (delta3 < avoidanceRadius) dangerRating[dangerIndex]+=10;
    //       if (delta1 < d1) dangerRating[dangerIndex]++;
    //       if (delta2 < d2) dangerRating[dangerIndex]++;
    //       if (delta3 < d3) dangerRating[dangerIndex]++;
    //       if (far1 < d1) dangerRating[dangerIndex]+=20;
    //       if (far2 < d2) dangerRating[dangerIndex]+=20;
    //       if (far3 < d3) dangerRating[dangerIndex]+=20;
    //     }
    //   }
    // }

    // let movementOptions : Array<number> = [];
    // let lowestRating = 999999;
    // for (var i = 0; i < dangerRating.length; i++) {
    //   if (dangerRating[i] == lowestRating) {
    //     movementOptions.push(i);
    //   }
    //   else if (dangerRating[i] < lowestRating) {
    //     movementOptions = [];
    //     movementOptions.push(i);
    //     lowestRating = dangerRating[i];
    //   }
    // }

    // if (lowestRating > 0) {
    //   let text = 'Pick between: ';
    //   for (var i = 0; i < movementOptions.length; i++) {
    //     text += ' ' + (movementOptions[i] + 1);
    //   }
    //   console.log(text);
    //   if (movementOptions.length > 1) {
    //     for (var i = 0; i < movementOptions.length; i++) {
    //       if ((movementOptions[i] + 1) == 5) {
    //         movementOptions.splice(i, 1);
    //         console.log('remove 5');
    //         break;
    //       }
    //     }
    //   }
    //   text = 'Pick between: ';
    //   for (var i = 0; i < movementOptions.length; i++) {
    //     text += ' ' + (movementOptions[i] + 1);
    //   }
    //   console.log(text);

    //   let index = Math.floor(Math.random() * movementOptions.length);
    //   let choice = movementOptions[index] + 1;
    //   console.log('pick choice ' + choice);
    //   if (choice == 1 || choice == 4 || choice == 7) input.HorizontalMovement = -1;
    //   if (choice == 3 || choice == 6 || choice == 9) input.HorizontalMovement = 1;
    //   if (choice == 1 || choice == 2 || choice == 3) input.VerticalMovement = 1;
    //   if (choice == 7 || choice == 8 || choice == 9) input.VerticalMovement = -1;
    // }

  }

  trackPlayer(me, you, input) {
    // if (you.y < me.y) {
    //   input.VerticalMovement = -1;
    // } else {
    //   input.VerticalMovement = 1;
    // }
  }

  update() {
    // Update any graphic objects we want to draw.
  }

  sendPeerMessage(message) {
    this.gameScene.handleRemoteData(message);
  }

  onPeerMessage(data) {
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
      console.error("INVALID FOR AI PLAYER");
    } else {
      console.log(data);
    }
  }

  startMatch() {
    this.setupNetcode();
  }

  stop() {
    if (this.rollbackNetcode) {
      this.rollbackNetcode!.stop();
    }
  }
}

function getSeekVector(me : PlayerState, position) : Vector {
  return new Vector([position.x - me.x, position.y - me.y]);
}

function getFleeVector(me : PlayerState, position) : Vector {
  return getSeekVector(me, position).scale(-1);
}

function getSeekAngle(me : PlayerState, position) : number {
  let angle = Math.atan2(position.y - me.y, position.x - me.x);
  return (angle + Math.PI * 2) % (Math.PI*2);
}

function getFleeAngle(me : PlayerState, position) : number {
  return (getSeekAngle(me, position) + Math.PI) % (Math.PI*2);
}

// function evade(target)  {
//   var distance = target.position - position;
//   var updatesAhead :int = distance.length / MAX_VELOCITY;
//   futurePosition :Vector3D = t.position + t.velocity * updatesAhead;
//   return flee(futurePosition);
// }

function getPositionFromMove(player : PlayerState, move, numMoves) {
  let newPos = {x: player.x, y: player.y };
  let moveSpeed = numMoves * Constants.CharacterSpeedPixelsPerFrame;
  if (move == 1) {
    newPos.x -= moveSpeed;
    newPos.y += moveSpeed;
  } else if (move == 2) {
    newPos.y += moveSpeed;
  } else if (move == 3) {
    newPos.x += moveSpeed;
    newPos.y += moveSpeed;
  } else if (move == 4) {
    newPos.x -= moveSpeed;
  } else if (move == 6) {
    newPos.x += moveSpeed;
  } else if (move == 7) {
    newPos.x -= moveSpeed;
    newPos.y -= moveSpeed;
  } else if (move == 8) {
    newPos.y -= moveSpeed;
  } else if (move == 9) {
    newPos.x += moveSpeed;
    newPos.y -= moveSpeed;
  }

  // Respect boundaries
  let topBound = 0;
  let bottomBound = topBound + Constants.PlayAreaHeight;
  let leftBound = player.leftBound;
  let rightBound = player.rightBound;
  if (newPos.x - player.radius < leftBound)   newPos.x = leftBound +    player.radius;
  if (newPos.x + player.radius > rightBound)  newPos.x = rightBound -   player.radius;
  if (newPos.y - player.radius < topBound)    newPos.y = topBound +     player.radius;
  if (newPos.y + player.radius> bottomBound)  newPos.y = bottomBound -  player.radius;

  return newPos;
}

function CalculateDistance(a, b) : number {
  return Math.sqrt((a.x - b.x) * (a.x - b.x)  + (a.y - b.y) * (a.y - b.y));
}

// function lineIntersectsCircle(ahead :Vector3D, ahead2 :Vector3D, obstacle :Circle) :Boolean {
//   // the property "center" of the obstacle is a Vector3D.
//   return distance(obstacle.center, ahead) <= obstacle.radius || distance(obstacle.center, ahead2) <= obstacle.radius;
// }
