import SimCharacter from "./sim-character.js";
import SimBullet from "./sim-bullet.js";
//import { CharacterInput } from '../interfaces';
import { ShotType } from "./enums.js";

const NoMansZoneWidth = 40;

// interface ReplayFrame {
//   tick : number,
//   input2 : CharacterInput,
// }

export default class Simulation {

  p1;// : SimCharacter;
  p2;// : SimCharacter;

  bullets;// : SimBullet[];

  playAreaWidth;// : number;
  playAreaHeight;// : number;

  nextBulletId;// : number;

  constructor() {
  }

  initialize(playAreaWidth, playAreaHeight, player1Name, player2Name) {

    var self = this;

    this.nextBulletId = 1;

    this.playAreaWidth = playAreaWidth;
    this.playAreaHeight = playAreaHeight;

    let p1StartX = playAreaWidth / 4;
    let p1StartY = playAreaHeight / 2;
    
    let p2StartX = playAreaWidth  * (3 /4);
    let p2StartY = playAreaHeight / 2;

    const NoMansZoneX = playAreaWidth / 2 - NoMansZoneWidth/2;

    this.p1 = new SimCharacter(1, player1Name, p1StartX, p1StartY, 1,
      0, NoMansZoneX,
      (ownerId, x, y, shotType, angle) => {
        self.fireBullet(ownerId, x, y, shotType, angle)
      }
    );

    this.p2 = new SimCharacter(2, player2Name, p2StartX, p2StartY, -1,
      NoMansZoneX + NoMansZoneWidth, playAreaWidth,
      (ownerId, x, y, shotType, angle) => {
        self.fireBullet(ownerId, x, y, shotType, angle)
      }
    );

    this.bullets = [];

  }

  submitInput(characterInput) {
    if (characterInput.OwnerId == 1) {
      this.p1.input = characterInput;
    } else if (characterInput.OwnerId == 2) {
      this.p2.input = characterInput;
    }
  }

  getWorldState() {
    return {
      p1: this.p1,
      p2: this.p2,
      bullets: this.bullets,
    };
  }

  fireBullet(ownerId, x, y, shotType, angle) {
    let id = this.nextBulletId;
    ++this.nextBulletId;
    let newBullet = new SimBullet(id, ownerId, x, y, shotType, angle);
    this.bullets.push(newBullet);
  }

  beforeRun() {
  }

  update(elapsedTime, delta) {
    // Handle Input
    this.p1.executeInput(delta);
    this.p2.executeInput(delta);

    // Update all bullets
    // Collision detection etc
    this.updateBullets(elapsedTime, delta);

    // Regen energy
    this.updateEnergy(delta);
  }

  deleteRemovedBullets() {
    for (var i = this.bullets.length - 1; i >= 0 ; --i) {
      let bullet = this.bullets[i];
      if (bullet.deadAtTime != null) {
        this.bullets.splice(i, 1);
      }
    }
  }

  isGameOver() {
    return this.p1.dead || this.p2.dead;
  }

  hasNewInput() {

    return (
      this.p1.input.HorizontalMovement != 0 ||
      this.p1.input.VerticalMovement != 0 ||
      this.p1.input.Shot != ShotType.None ||
      this.p2.input.HorizontalMovement != 0 ||
      this.p2.input.VerticalMovement != 0 ||
      this.p2.input.Shot != ShotType.None
    );
  }

  updateEnergy(delta) {
    this.p1.regenEnergy(delta);
    this.p2.regenEnergy(delta);
  }

  updateBullets(elapsedTime, delta) {
    for (var i = this.bullets.length - 1; i >= 0 ; --i) {
      let bullet = this.bullets[i];
      bullet.update(delta);

      // Skip if bullet is already removed.
      if (bullet.deadAtTime != null) {
        continue;
      }

      // Check for collisions between players
      let checkCollisionWithPlayer = null;
      if (bullet.owner == this.p1.id) {
        checkCollisionWithPlayer = this.p2;
      } else if (bullet.owner == this.p2.id) {
        checkCollisionWithPlayer = this.p1;
      }

      if (checkCollisionWithPlayer) {
        if (this.checkForCollisionBetweenCircles(bullet, checkCollisionWithPlayer)) {

          checkCollisionWithPlayer.takeDamage(bullet.shotType);

          // Delete the bullet.
          bullet.setAsRemoved(elapsedTime);
          continue;
        }
      }

      // Check bounds collision
      let topBound = 0;
      let bottomBound = 0 + this.playAreaHeight;
      let leftBound = 0;
      let rightBound = 0 + this.playAreaWidth;
      if (this.isCircleOutOfBounds(bullet, leftBound, rightBound, topBound, bottomBound)) {
        // Delete the bullet.
        bullet.setAsRemoved(elapsedTime);
      }
    }
  }

  
  checkForCollisionBetweenCircles(c1, c2) {
    return doCirclesOverlap(c1, c2);
  }

  isCircleOutOfBounds(circle, leftBound, rightBound, topBound, bottomBound) {
    return ((circle.x - circle.radius < leftBound) || 
        (circle.x + circle.radius > rightBound) ||
        (circle.y - circle.radius < topBound) ||
        (circle.y + circle.radius> bottomBound)
    );

  }
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



