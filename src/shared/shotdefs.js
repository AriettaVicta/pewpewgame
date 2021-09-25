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
ShotDefinitions[ShotType.VShot] = {
  Type: ShotType.VShot,
  Speed: 50,
  Radius: 5,
  Damage: 10,
  EnergyReq: 7,
  Color: 0xff6f00,
  MouseAim: false,
  ReloadSpeed: 300,
  NumExtraShots: 2,
  SpreadX: 35,
  SpreadY: 35,
}
ShotDefinitions[ShotType.BigSlow] = {
  Type: ShotType.BigSlow,
  Speed: 15,
  Radius: 15,
  Damage: 10,
  EnergyReq: 14,
  Color: 0x88c289,
  MouseAim: true,
  ReloadSpeed: 500,
  NumShots: 3,
}

ShotDefinitions[ShotType.SpreadShot] = {
  Type: ShotType.SpreadShot,
  Speed: 15,
  Radius: 15,
  Damage: 10,
  EnergyReq: 30,
  Color: 0xfc8803,
  MouseAim: true,
  ReloadSpeed: 600,
  NumProjectiles: 6,
  SpreadAngle: 15 * Math.PI/180,
}

ShotDefinitions[ShotType.DelayedShot] = {
  Type: ShotType.DelayedShot,
  Speed: 80,
  Radius: 5,
  Damage: 10,
  EnergyReq: 30,
  Color: 0xd447ff,
  MouseAim: false,
  ReloadSpeed: 1000,
  DelayTimeMs: 3000,
}

ShotDefinitions[ShotType.Turret] = {
  Type: ShotType.Turret,
  Radius: 15,
  EnergyReq: 50,
  Color: 0xd447ff,
  MouseAim: false,
  ReloadSpeed: 5000,

  NumProjectiles: 10,
  DelayBetweenShotMs: 2000,
  TurretProjectile: ShotType.BigSlow,
}



export default ShotDefinitions;
