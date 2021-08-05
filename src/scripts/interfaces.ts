export interface CharacterInput {
  // Meta
  OwnerId : number,
  TimeSinceServerUpdate: number,

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