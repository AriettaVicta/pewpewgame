import Constants from '../../shared/constants';
import { ShotType } from '../../shared/enums';
import ShotDefinitions from '../../shared/shotdefs';
import { BulletState } from '../gamestate/types';
import BulletGraphic from './bulletgraphic';

export default class LaserGraphic extends BulletGraphic {

  rect : Phaser.GameObjects.Rectangle;

  constructor(scene : Phaser.Scene, bulletState : BulletState) {
    super(bulletState.id);

    let color = ShotDefinitions[bulletState.shotType].Color;

    this.rect = scene.add.rectangle(bulletState.x, bulletState.y, 10, ShotDefinitions[ShotType.Laser].Width, color, 1);
    this.rect.setOrigin(0.5, 0.5);

    scene.add.existing(this.rect)
  }

  update(bullet : BulletState) {
    this.rect.x = bullet.x + Constants.PlayAreaBufferX;
    this.rect.y = bullet.y + Constants.PlayAreaBufferY;

    if (bullet.chargeTimeRemaining > 0) {

    } else {
      if (bullet.angle == 0) {
        this.rect.width = Constants.PlayAreaWidth - bullet.x;
      } else {
        this.rect.x = Constants.PlayAreaBufferX;
        this.rect.width = bullet.x;
      }
    }
  }

  destroy() {
    this.rect.destroy();
  }
}
