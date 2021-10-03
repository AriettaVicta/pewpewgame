import Constants from '../../shared/constants';
import ShotDefinitions from '../../shared/shotdefs';
import { BulletState } from '../gamestate/types';
import BulletGraphic from './bulletgraphic';

export default class BallGraphic extends BulletGraphic {

  arc : Phaser.GameObjects.Arc;

  constructor(scene : Phaser.Scene, bulletState : BulletState) {
    super(bulletState.id);

    let radius = ShotDefinitions[bulletState.shotType].Radius;
    let color = ShotDefinitions[bulletState.shotType].Color;

    this.arc = scene.add.arc(bulletState.x, bulletState.y, radius);
    this.arc.setFillStyle(color, 1);
    this.arc.setOrigin(0.5, 0.5);

    scene.add.existing(this.arc)
  }

  update(bullet : BulletState) {
    this.arc.x = bullet.x + Constants.PlayAreaBufferX;
    this.arc.y = bullet.y + Constants.PlayAreaBufferY;
  }

  destroy() {
    this.arc.destroy();
  }
}
