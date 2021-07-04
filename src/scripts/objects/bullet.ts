import {ShotType} from '../enums';
import Constants from '../contants';
import SimBullet from '../simulation/sim-bullet';
import ShotDefinitions from '../shotdefs';

export default class Bullet extends Phaser.GameObjects.Arc {

  id : number;
  angle : number;
  owner : number;
  shotType : ShotType;

  constructor(scene, simBullet : SimBullet) {
    let radius = ShotDefinitions[simBullet.shotType].Radius;
    let color = ShotDefinitions[simBullet.shotType].Color;
    super(scene, simBullet.x, simBullet.y, radius)
    this.setFillStyle(color, 1);
    this.setOrigin(0.5, 0.5);

    this.id = simBullet.id;
    this.owner = simBullet.owner;
    this.angle = simBullet.angle;
    this.shotType = simBullet.shotType;

    this.updatePositionFromSimBullet(simBullet);

    scene.add.existing(this)
  }

  updatePositionFromSimBullet(simBullet) {
    this.x = simBullet.x + Constants.PlayAreaBufferX;
    this.y = simBullet.y + Constants.PlayAreaBufferY;
  }
}
