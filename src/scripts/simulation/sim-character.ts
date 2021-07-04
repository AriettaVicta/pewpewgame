import Constants from '../contants';
import { ShotType } from '../enums';
import { CharacterInput } from '../interfaces';
import ShotDefinitions from '../shotdefs';

const CharacterRadius = 10;
const CharacterSpeed = 5;

export default class SimCharacter {

  x : number;
  y : number;
  radius: number;

  leftBound : number;
  rightBound : number;
  facingDirection : number;
  fireBullet;
  id : number;
  health : number;
  energy : number;
  dead : boolean;
  input : CharacterInput;

  constructor(id, x, y, facingDirection, leftBound, rightBound, fireBullet) {

    this.x = x;
    this.y = y;
    this.radius = CharacterRadius;

    this.id = id;
    this.facingDirection = facingDirection;
    this.leftBound = leftBound;
    this.rightBound = rightBound;
    this.fireBullet = fireBullet;
    this.health = Constants.CharacterMaxHealth;
    this.energy = Constants.CharacterStartingEnergy;
    this.dead = false;
  }

  executeInput() {
    this.move(this.input);
    this.shoot(this.input);
  }

  move(input : CharacterInput) {
    if (input.HorizontalMovement != 0) {
      this.x += input.HorizontalMovement * CharacterSpeed;
    }
    if (input.VerticalMovement != 0) {
      this.y += input.VerticalMovement * CharacterSpeed;
    }

    // Respect boundaries
    let topBound = 0;
    let bottomBound = topBound + Constants.PlayAreaHeight;
    let leftBound = this.leftBound;
    let rightBound = this.rightBound;
    if (this.x - this.radius < leftBound) this.x = leftBound + this.radius;
    if (this.x + this.radius > rightBound) this.x = rightBound - this.radius;
    if (this.y - this.radius < topBound) this.y = topBound + this.radius;
    if (this.y + this.radius> bottomBound) this.y = bottomBound - this.radius;
  }

  shoot(input : CharacterInput) {
    if (input.Shot != ShotType.None) {

      let energyNeeded = ShotDefinitions[input.Shot].EnergyReq;
      if (this.energy >= energyNeeded) {

        // Subtract the energy needed
        this.energy -= energyNeeded;

        // Create the bullet.
        let angle = (this.facingDirection == 1) ? 0 : Math.PI;
        if (input.Shot == ShotType.BigSlow) {
          // Adjust the angle based on the VerticalMovement of the character.
          if (input.VerticalMovement > 0) {
            angle += (10 * Math.PI / 180);
          } else if (input.VerticalMovement < 0) {
            angle -= (10 * Math.PI / 180);
          }
        }

        // Adjust the x value based on which direction we're firing.
        let bulletX = this.x + (this.radius * this.facingDirection);
        let bulletY = this.y;

        this.fireBullet(this.id, bulletX, bulletY, input.Shot, angle);
      }
    }
  }

  takeDamage(shotType : ShotType) {
    this.health -= ShotDefinitions[shotType].Damage;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }

  regenEnergy() {
    this.energy += Constants.CharacterRegenEnergyAmount;
    this.energy = Math.round((this.energy + Number.EPSILON)* 100) / 100;
    if (this.energy > Constants.CharacterMaxEnergy) {
      this.energy = Constants.CharacterMaxEnergy;
    }
  }
}

