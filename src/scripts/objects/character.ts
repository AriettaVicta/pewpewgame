import Constants from '../contants';
import { ShotType } from '../enums';
import { CharacterInput } from '../interfaces';

const CharacterRadius = 10;
const CharacterSpeed = 5;

export default class Character extends Phaser.GameObjects.Arc {

  facingDirection : number;
  fireBullet;
  id : number;

  constructor(scene, id, color, facingDirection) {
    let radius = CharacterRadius;
    super(scene, 0, 0, radius)

    this.id = id;
    this.facingDirection = facingDirection;

    this.setFillStyle(color, 1);
    this.setOrigin(0.5, 0.5);

    scene.add.existing(this)
  }
}
