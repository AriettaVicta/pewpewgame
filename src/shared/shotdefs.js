import { ShotType } from "./enums.js";
import Constants from "./constants.js";

// interface ShotDefinition {
//   Type : ShotType,
//   Speed : number,
//   Radius : number,
//   Damage : number,
//   EnergyReq : number,
//   Color : number,
//   MouseAim : boolean,
//   ReloadSpeed : number,
// }

var ShotDefinitions;// : ShotDefinition[];

ShotDefinitions = [];
ShotDefinitions[ShotType.Plain] = {
  Type: ShotType.Plain,
  Speed: 0.4,
  Radius: 5,
  Damage: 10,
  EnergyReq: 5,
  Color: 0xff6f00,
  MouseAim: false,
  ReloadSpeed: Constants.TargetFrameTime * 5,
}
ShotDefinitions[ShotType.BigSlow] = {
  Type: ShotType.BigSlow,
  Speed: 0.1,
  Radius: 15,
  Damage: 10,
  EnergyReq: 10,
  Color: 0x88c289,
  MouseAim: true,
  ReloadSpeed: Constants.TargetFrameTime * 10,
}

export default ShotDefinitions;
