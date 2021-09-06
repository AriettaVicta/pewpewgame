import Constants from '../../shared/constants';
import SimBullet from '../../shared/sim-bullet';
import ShotDefinitions from '../../shared/shotdefs';
import { BulletState } from '../gamestate/types';

export default class BulletGraphic extends Phaser.GameObjects.Arc {

  id : number;
  angle : number;
  owner : number;
  shotType : number;

  constructor(scene, bulletState : BulletState) {
    let radius = ShotDefinitions[bulletState.shotType].Radius;
    let color = ShotDefinitions[bulletState.shotType].Color;
    super(scene, bulletState.x, bulletState.y, radius)
    this.setFillStyle(color, 1);
    this.setOrigin(0.5, 0.5);

    this.id = bulletState.id;
    this.owner = bulletState.owner;
    this.angle = bulletState.angle;
    this.shotType = bulletState.shotType;

    scene.add.existing(this)
  }
}
