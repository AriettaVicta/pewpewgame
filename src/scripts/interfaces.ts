export interface CharacterInput {
  // Meta
  Sequence : number,
  OwnerId : number,
  TimeOfEvent: number,

  // Input
  VerticalMovement : number,
  HorizontalMovement : number,
  Shot: number,
  AimAngle: number,
}

export interface ServerPlayerInfo {
  Name: string,
  Id: string,
  State: number,
}