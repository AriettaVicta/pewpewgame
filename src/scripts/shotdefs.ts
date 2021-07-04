import { ShotType } from "./enums";

interface ShotDefinition {
  Type : ShotType,
  Speed : number,
  Radius : number,
  Damage : number,
  EnergyReq : number,
  Color : number,
}

var ShotDefinitions : ShotDefinition[];

ShotDefinitions = [];
ShotDefinitions[ShotType.Plain] = {
  Type: ShotType.Plain,
  Speed: 20,
  Radius: 5,
  Damage: 10,
  EnergyReq: 5,
  Color: 0xff6f00,
}
ShotDefinitions[ShotType.BigSlow] = {
  Type: ShotType.BigSlow,
  Speed: 3,
  Radius: 15,
  Damage: 10,
  EnergyReq: 10,
  Color: 0x88c289,
}

export default ShotDefinitions;
