
//import {ShotType} from '../enums';
//import Constants from '../contants';
import ShotDefinitions from './shotdefs.js';

export default class SimBullet {

  id;

  angle;
  speed;
  owner;
  shotType;

  x;
  y;
  radius;

  deadAtTime;

  constructor(id, owner, x, y, shotType, angle) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.radius = ShotDefinitions[shotType].Radius;

    this.owner = owner;
    this.angle = angle;
    this.shotType = shotType;
    this.speed = ShotDefinitions[shotType].Speed;
    this.deadAtTime = null;
  }

  update(delta) {
    if (this.deadAtTime == null) {
      this.x = this.x + Math.cos(this.angle) * this.speed * delta;
      this.y = this.y + Math.sin(this.angle) * this.speed * delta;
    }
  }

  setAsRemoved(time) {
    this.deadAtTime = time; 
  }
}