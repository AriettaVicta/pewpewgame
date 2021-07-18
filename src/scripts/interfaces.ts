export interface CharacterInput {
  // Meta
  OwnerId : number,
  TimeSinceServerUpdate: number,

  // Input
  VerticalMovement : number,
  HorizontalMovement : number,
  Shot: number,
}