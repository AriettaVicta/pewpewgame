import { NetplayPlayer, NetplayState, DefaultInput, NetplayInput } from 'netplayjs';
import { GameInput, PlayerState, BulletState } from './types';
import Constants from '../../shared/constants';

import { ShotType } from '../../shared/enums';
import ShotDefinitions from '../../shared/shotdefs';

export class GameState extends NetplayState<GameInput> {

  Player1 : PlayerState;
  Player2 : PlayerState;
  Bullets : Array<BulletState>;

  NextBulletId : number;

  constructor() {
    super();

    this.NextBulletId = 1;

    let p1StartX = Constants.PlayAreaWidth / 4;
    let p1StartY = Constants.PlayAreaHeight / 2;
    
    let p2StartX = Constants.PlayAreaWidth  * (3 /4);
    let p2StartY = Constants.PlayAreaHeight / 2;

    const NoMansZoneX = Constants.PlayAreaWidth / 2 - Constants.NoMansZoneWidth/2;
    this.Player1 = new PlayerState(
      1, // id
      p1StartX, 
      p1StartY, 
      Constants.CharacterRadius,
      0, NoMansZoneX, // bounds
      1 // facingDirection
    );
    this.Player2 = new PlayerState(
      2, // id
      p2StartX, 
      p2StartY, 
      Constants.CharacterRadius,
      NoMansZoneX + Constants.NoMansZoneWidth, Constants.PlayAreaWidth, // bounds
      -1 // facingDirection
    );

    this.Bullets = [];
  }

  getStateForPlayer(player : NetplayPlayer) {
    if (player.getID() == 0) {
      return this.Player1;
    } else if (player.getID() == 1) {
      return this.Player2;
    }
    return this.Player2;
  }

  tick(playerInputs: Map<NetplayPlayer, GameInput>) {
    // Handle inputs
    for (const [player, input] of playerInputs.entries()) {
      let stateForPlayer = this.getStateForPlayer(player);
      this.playerMove(stateForPlayer, input);
      this.playerShoot(stateForPlayer, input);
    }

    this.updateBullets();

    // Regen energy
    this.updateEnergy();
  }

  playerMove(player : PlayerState, input : GameInput) {
    if (input.HorizontalMovement != 0) {
      player.x += input.HorizontalMovement * Constants.CharacterSpeedPixelsPerFrame;
    }
    if (input.VerticalMovement != 0) {
      player.y += input.VerticalMovement * Constants.CharacterSpeedPixelsPerFrame;
    }

    // Respect boundaries
    let topBound = 0;
    let bottomBound = topBound + Constants.PlayAreaHeight;
    let leftBound = player.leftBound;
    let rightBound = player.rightBound;
    if (player.x - player.radius < leftBound)   player.x = leftBound +    player.radius;
    if (player.x + player.radius > rightBound)  player.x = rightBound -   player.radius;
    if (player.y - player.radius < topBound)    player.y = topBound +     player.radius;
    if (player.y + player.radius> bottomBound)  player.y = bottomBound -  player.radius;
  }

  playerShoot(player : PlayerState, input : GameInput) {

    if (input.Shot != ShotType.None) {

      let energyNeeded = ShotDefinitions[input.Shot].EnergyReq;
      let hasEnoughEnergy = player.energy >= energyNeeded;
      let lastShot = player.lastShotTime[input.Shot];
      if (!lastShot) lastShot = 0;
      let timeSinceLastShot = Date.now() - lastShot;
      let canFire = timeSinceLastShot > ShotDefinitions[input.Shot].ReloadSpeed;

      if (hasEnoughEnergy && canFire) {

        // Subtract the energy needed
        player.energy -= energyNeeded;

        // Create the bullet.
        let angle = (player.facingDirection == 1) ? 0 : Math.PI;
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
        let bulletX = player.x + (player.radius * player.facingDirection);
        let bulletY = player.y;

        let newBullet = new BulletState(
          this.NextBulletId++,
          player.id,
          angle,
          input.Shot,
          bulletX,
          bulletY
        );
        
        this.Bullets.push(newBullet);
        player.lastShotTime[input.Shot] = Date.now();
      }
    }
  }

  updateEnergy() {
    this.regenEnergyForPlayer(this.Player1);
    this.regenEnergyForPlayer(this.Player2);
    this.Player1.energy
  }

  regenEnergyForPlayer(player : PlayerState) {
    player.energy += (Constants.CharacterRegenEnergyAmountPerSecond / Constants.Timestep);
    player.energy = Math.round((player.energy + Number.EPSILON)* 100) / 100;
    if (player.energy > Constants.CharacterMaxEnergy) {
      player.energy = Constants.CharacterMaxEnergy;
    }

  }

  updateBullets() {
    for (var i = this.Bullets.length - 1; i >= 0 ; --i) {
      let bullet = this.Bullets[i];
      
      bullet.x = bullet.x + Math.cos(bullet.angle) * (bullet.speed / Constants.Timestep);
      bullet.y = bullet.y + Math.sin(bullet.angle) * (bullet.speed / Constants.Timestep);

      // Check for collisions between players
      let checkCollisionWithPlayer : PlayerState | null = null;
      if (bullet.owner == this.Player1.id) {
        checkCollisionWithPlayer = this.Player2;
      } else if (bullet.owner == this.Player2.id) {
        checkCollisionWithPlayer = this.Player1;
      }

      if (checkCollisionWithPlayer) {
        if (CheckForCollisionBetweenCircles(bullet, checkCollisionWithPlayer)) {

          this.takeDamage(checkCollisionWithPlayer, bullet.shotType);

          // Delete the bullet.
          this.Bullets.splice(i, 1);
          continue;
        }
      }

      // Check bounds collision
      let topBound = 0;
      let bottomBound = 0 + Constants.PlayAreaHeight;
      let leftBound = 0;
      let rightBound = 0 + Constants.PlayAreaWidth;
      if (IsCircleOutOfBounds(bullet, leftBound, rightBound, topBound, bottomBound)) {
        // Delete the bullet.
        this.Bullets.splice(i, 1);
        continue;
      }
    }
  }

  takeDamage(player, shotType) {
    player.health -= ShotDefinitions[shotType].Damage;
    if (player.health <= 0) {
      player.health = 0;
      player.dead = true;
    }
  }
}


function CheckForCollisionBetweenCircles(c1, c2) {
  return doCirclesOverlap(c1, c2);
}

function IsCircleOutOfBounds(circle, leftBound, rightBound, topBound, bottomBound) {
  return ((circle.x - circle.radius < leftBound) || 
      (circle.x + circle.radius > rightBound) ||
      (circle.y - circle.radius < topBound) ||
      (circle.y + circle.radius> bottomBound)
  );
}

function doCirclesOverlap(c1, c2) {
  let overlaps = false;
  if (intersection(c1.x, c1.y, c1.radius, c2.x, c2.y, c2.radius)) {
    overlaps = true;
  }
  return overlaps;
}

// https://stackoverflow.com/questions/12219802/a-javascript-function-that-returns-the-x-y-points-of-intersection-between-two-ci
function intersection(x0, y0, r0, x1, y1, r1) {
  var a, dx, dy, d, h, rx, ry;
  var x2, y2;

  /* dx and dy are the vertical and horizontal distances between
   * the circle centers.
   */
  dx = x1 - x0;
  dy = y1 - y0;

  /* Determine the straight-line distance between the centers. */
  d = Math.sqrt((dy*dy) + (dx*dx));

  /* Check for solvability. */
  if (d > (r0 + r1)) {
      /* no solution. circles do not intersect. */
      return false;
  }
  if (d < Math.abs(r0 - r1)) {
      /* no solution. one circle is contained in the other */
      return [];
  }

  /* 'point 2' is the point where the line through the circle
   * intersection points crosses the line between the circle
   * centers.  
   */

  /* Determine the distance from point 0 to point 2. */
  a = ((r0*r0) - (r1*r1) + (d*d)) / (2.0 * d) ;

  /* Determine the coordinates of point 2. */
  x2 = x0 + (dx * a/d);
  y2 = y0 + (dy * a/d);

  /* Determine the distance from point 2 to either of the
   * intersection points.
   */
  h = Math.sqrt((r0*r0) - (a*a));

  /* Now determine the offsets of the intersection points from
   * point 2.
   */
  rx = -dy * (h/d);
  ry = dx * (h/d);

  /* Determine the absolute intersection points. */
  var xi = x2 + rx;
  var xi_prime = x2 - rx;
  var yi = y2 + ry;
  var yi_prime = y2 - ry;

  return [xi, xi_prime, yi, yi_prime];
}


