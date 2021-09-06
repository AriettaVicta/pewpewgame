import Constants from './constants.js';
import { ShotType } from './enums.js';
//import { CharacterInput } from '../interfaces.js';
import ShotDefinitions from './shotdefs.js';

import cloneDeep from 'lodash.clonedeep';

const CharacterRadius = 10;
const CharacterSpeedPerMs = 0.5;

export default class SimCharacter {

  x;
  y;
  radius;

  leftBound;
  rightBound;
  facingDirection;
  id;
  name;
  health;
  maxHealth;
  energy;
  maxEnergy;
  dead;
  input;
  bulletWaitingToShoot;
  lastSequenceProcessed;

  lastShotTime;

  constructor(id, name, x, y, facingDirection, leftBound, rightBound) {

    // Permanent
    this.id = id;
    this.name = name;
    this.facingDirection = facingDirection;
    this.leftBound = leftBound;
    this.rightBound = rightBound;
    this.radius = CharacterRadius;
    this.maxHealth = Constants.CharacterMaxHealth;
    this.maxEnergy = Constants.CharacterMaxEnergy;

    // State that changes and is copied
    this.x = x;
    this.y = y;

    this.health = Constants.CharacterMaxHealth;
    this.energy = Constants.CharacterStartingEnergy;
    this.dead = false;
    this.lastShotTime = [];
    this.lastSequenceProcessed = 0;
    this.input = null;

    // Bookkeeping
    this.bulletWaitingToShoot = null;
  }

  copyState(other) {
    this.x = other.x;
    this.y = other.y;
    this.health = other.health;
    this.energy = other.energy;
    this.dead = other.dead;
    this.lastShotTime = cloneDeep(other.lastShotTime);
    this.lastSequenceProcessed = other.lastSequenceProcessed;
    this.input = cloneDeep(other.input);
  }

  setInput(input) {
    this.input = input;
  }

  executeInput(delta) {
    if (this.input) {
      this.move(delta);
      this.shoot();
      this.input.Shot = ShotType.None;
      this.lastSequenceProcessed = this.input.Sequence;
    }
  }

  move(delta) {
    if (this.input.HorizontalMovement != 0) {
      this.x += this.input.HorizontalMovement * CharacterSpeedPerMs * delta;
    }
    if (this.input.VerticalMovement != 0) {
      this.y += this.input.VerticalMovement * CharacterSpeedPerMs * delta;
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

  shoot() {
    let input = this.input;
    if (input.Shot != ShotType.None) {

      let energyNeeded = ShotDefinitions[input.Shot].EnergyReq;
      let hasEnoughEnergy = this.energy >= energyNeeded;
      let lastShot = this.lastShotTime[input.Shot];
      if (!lastShot) lastShot = 0;
      let timeSinceLastShot = Date.now() - lastShot;
      let canFire = timeSinceLastShot > ShotDefinitions[input.Shot].ReloadSpeed;

      if (hasEnoughEnergy && canFire) {

        // Subtract the energy needed
        this.energy -= energyNeeded;

        // Create the bullet.
        let angle = (this.facingDirection == 1) ? 0 : Math.PI;
        if (ShotDefinitions[input.Shot].MouseAim) {
          angle = input.AimAngle;
        }
        // if (input.Shot == ShotType.BigSlow) {
        //   // Adjust the angle based on the VerticalMovement of the character.
        //   let addAngle = input.VerticalMovement * this.facingDirection;
        //   if (addAngle > 0) {
        //     angle += (10 * Math.PI / 180);
        //   } else if (addAngle < 0) {
        //     angle -= (10 * Math.PI / 180);
        //   }
        // }

        // Adjust the x value based on which direction we're firing.
        let bulletX = this.x + (this.radius * this.facingDirection);
        let bulletY = this.y;

        this.bulletWaitingToShoot = {
          id: this.id,
          bulletX: bulletX,
          bulletY: bulletY,
          shot: input.Shot,
          angle: angle,
        }
        this.lastShotTime[input.Shot] = Date.now();
      }
    }
  }

  takeDamage(shotType) {
    this.health -= ShotDefinitions[shotType].Damage;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }

  regenEnergy(delta) {
    this.energy += Constants.CharacterRegenEnergyAmountPerSecond * delta;
    this.energy = Math.round((this.energy + Number.EPSILON)* 100) / 100;
    if (this.energy > Constants.CharacterMaxEnergy) {
      this.energy = Constants.CharacterMaxEnergy;
    }
  }
}

