import Constants from '../../shared/constants';
import SimBullet from '../../shared/sim-bullet';
import ShotDefinitions from '../../shared/shotdefs';

export default class BulletGraphic extends Phaser.GameObjects.Arc {

  id : number;
  angle : number;
  owner : number;
  shotType : number;

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

    scene.add.existing(this)
  }

  interpolatePosition(prev : SimBullet, next : SimBullet, percent : number) {
    let x = ((next.x - prev.x) * percent) + prev.x;
    let y = ((next.y - prev.y) * percent) + prev.y;

    this.x = x + Constants.PlayAreaBufferX;
    this.y = y + Constants.PlayAreaBufferY;
  }
}
