
import {ShotType} from '../enums';
import Constants from '../contants';
import ShotDefinitions from '../shotdefs';

export default class SimBullet {

  id : number;

  angle : number;
  speed : number;
  owner : number;
  shotType : ShotType;

  x : number;
  y : number;
  radius : number;

  constructor(id, owner, x, y, shotType : ShotType, angle : number) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.radius = ShotDefinitions[shotType].Radius;

    this.owner = owner;
    this.angle = angle;
    this.shotType = shotType;
    this.speed = ShotDefinitions[shotType].Speed;
  }

  update() {
    this.x = this.x + Math.cos(this.angle) * this.speed;
    this.y = this.y + Math.sin(this.angle) * this.speed;
  }
}