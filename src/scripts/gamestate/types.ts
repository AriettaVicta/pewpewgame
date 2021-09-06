import { NetplayPlayer, NetplayState, DefaultInput, NetplayInput } from 'netplayjs';
import ShotDefinitions from '../../shared/shotdefs';
import Constants from '../../shared/constants';
import { ShotType } from '../../shared/enums';

export class GameInput extends NetplayInput<GameInput> {
  constructor() {
    super();
    this.VerticalMovement = 0;
    this.HorizontalMovement = 0;
    this.Shot = ShotType.None;
    this.AimAngle = 0;
  }

  VerticalMovement : number;
  HorizontalMovement : number;
  Shot: number;
  AimAngle: number;
}

export class PlayerState {
  x : number;
  y : number;
  radius : number;

  leftBound : number;
  rightBound : number;
  facingDirection : number;
  id : number;
  name : string;
  health : number;
  maxHealth : number;
  energy : number;
  maxEnergy : number;
  dead : boolean;
  lastShotTime : Array<number>;

  constructor(id, x, y, radius, leftBound, rightBound, facingDirection) {

    this.x = x;
    this.y = y;
    this.radius = radius;
    this.leftBound = leftBound;
    this.rightBound = rightBound;
    this.facingDirection = facingDirection;
    this.id = id;

    this.maxHealth = Constants.CharacterMaxHealth;
    this.maxEnergy = Constants.CharacterMaxEnergy;
    this.health = Constants.CharacterMaxHealth;
    this.energy = Constants.CharacterStartingEnergy;

    this.dead = false;
    this.lastShotTime = [];
  }
}

export class BulletState {

  constructor(id, owner, angle, shotType, x, y) {
    this.id = id;
    this.owner = owner;
    this.angle = angle;
    this.shotType = shotType;
    this.x = x;
    this.y = y;

    this.radius = ShotDefinitions[shotType].Radius;
    this.speed = ShotDefinitions[shotType].Speed;
  }

  id : number;

  angle : number;
  speed : number;
  owner : number;
  shotType : number;

  x : number;
  y : number;
  radius : number;
}