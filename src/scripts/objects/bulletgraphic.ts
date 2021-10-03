import { BulletState } from "../gamestate/types";

export default abstract class BulletGraphic {

  id : number;
  constructor(id : number) {
    this.id = id;
  }
  abstract update(bulletState : BulletState);
  abstract destroy();
}
