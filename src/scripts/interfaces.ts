import {ShotType} from './enums';

export interface CharacterInput {
  OwnerId : number,
  VerticalMovement : number,
  HorizontalMovement : number,
  Shot: ShotType,
}