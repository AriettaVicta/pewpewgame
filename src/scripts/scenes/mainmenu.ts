import { ServerPlayerState, ShotType } from '../../shared/enums';
import TextButton from '../objects/textbutton';
import SocketManager from '../socket/socketmanager';
import VirtualJoyStick from 'phaser3-rex-plugins/plugins/virtualjoystick.js';
import EnergyBar from '../objects/energybar';
import ShotDefinitions from '../../shared/shotdefs';
import { Menu } from 'phaser3-rex-plugins/templates/ui/ui-components.js';
import Constants from '../../shared/constants';

export default class MainMenuScene extends Phaser.Scene {

  quickMatchButton : TextButton;
  howToPlayButton : TextButton;
  vsAIButton : TextButton;

  peer1 : TextButton;
  peer2 : TextButton;
  peerMessage : TextButton;

  nameBox;
  changedNameTimer : number;

  playerListBox : Phaser.GameObjects.Text;
  loadoutLabel : Phaser.GameObjects.Text;

  game : any;

  weaponDropdowns;
  rexUI;

  constructor() {
    super({ key: 'MainMenuScene' })
  }

  beginGame(vsAI) {

    let loadout = this.getLoadout();

    this.game.MatchStartOptions = {
      vsAI: vsAI,
      loadout: loadout,
    };
    this.scene.start('GameplayScene')
  }

  create() {
    var self = this;

    let options : any = [];

    for (var i = ShotType.First; i <= ShotType.Last; i++) {
      options.push(ShotDefinitions[i].FriendlyName);
    }

    this.weaponDropdowns = [];
    let dropdownsY = 600;
    let dropdownsX = 250;

    this.loadoutLabel = this.add.text(dropdownsX - 150, dropdownsY - 100,
      'Weapon Loadout:', { 
      color: 'white',
      fontSize: '48px',
    }).setOrigin(0, 0);

    for (var i = 0; i < Constants.WeaponLoadoutSize; i++) {
      let newDropdown = CreateDropDownList(this, dropdownsX, dropdownsY, options).layout();

      newDropdown.setData('value', ShotDefinitions[ShotType.First + i].FriendlyName);

      self.weaponDropdowns.push(newDropdown);
      dropdownsX += 350;
    }


    if (!self.game.socketManager) {
      self.game.socketManager = new SocketManager();
    }
    self.game.socketManager.setCurrentScene(this);

    this.quickMatchButton = new TextButton(this, 200, 250, 'Quickmatch', () => {
      self.beginGame(false);
    }, false, null)
    this.howToPlayButton = new TextButton(this, 200, 400, 'How to Play', () => {
      self.scene.start('HowToPlayScene')
    }, false, null)
    this.vsAIButton = new TextButton(this, 600, 400, 'VS AI', () => {
      self.beginGame(true);
    }, false, null)

    this.add.text(200, 100,
      'Name:', { 
      color: 'white',
      fontSize: '32px',
    }).setOrigin(0, 0);
    
    self.nameBox = this.add.dom(320, 100).createElement('input').setOrigin(0,0);
    self.nameBox.node.style.fontSize = '24px';
    self.nameBox.node.style.pointerEvents = 'auto';
    self.nameBox.node.value = self.game.socketManager.getPlayerName();
    self.nameBox.node.maxLength = 15;
    self.nameBox.addListener('keydown');

    self.nameBox.on('keydown', function (event) {
      self.changedNameTimer = Date.now();
    });

    this.add.text(500, 200,
      'Players:', { 
      color: 'white',
      fontSize: '32px',
    }).setOrigin(0, 0);
    this.playerListBox = this.add.text(500, 250,
      '', { 
      color: 'white',
      fontSize: '32px',
    }).setOrigin(0, 0);
    this.playerListBox.setText(this.getTextFromPlayerList(self.game.socketManager.getPlayerList()));
  }

  update(time, delta) {
    if (this.changedNameTimer) {
      if (Date.now() - this.changedNameTimer > 1000) {
        this.changedNameTimer = 0;
        if (this.nameBox.node.value != '' && this.nameBox.node.value != this.game.socketManager.getPlayerName()) {
          this.game.socketManager.updatePlayerName(this.nameBox.node.value);
          //localStorage.setItem('playername', self.nameBox.node.value);
        }
      }
    }
  }

  getLoadout() {
    let loadout : Array<number> = [];

    for (let dropdownIndex = 0; dropdownIndex < Constants.WeaponLoadoutSize; dropdownIndex++) {
      let friendlyName = this.weaponDropdowns[dropdownIndex].getData('value');
      for (var shotTypeIndex = ShotType.First; shotTypeIndex <= ShotType.Last; shotTypeIndex++) {
        if (ShotDefinitions[shotTypeIndex].FriendlyName == friendlyName) {
          loadout.push(shotTypeIndex);
          break;
        }
      }
    }

    return loadout;
  }

  nameUpdate(newName) {
    this.nameBox.node.value = newName;
  }

  getStateString(state) {
    if (state == ServerPlayerState.Lobby) {
      return 'Lobby';
    } else if (state == ServerPlayerState.Searching) {
      return 'Searching';
    } else if (state == ServerPlayerState.Playing) {
      return 'Playing';
    } else {
      return '???'
    }
  }

  getTextFromPlayerList(list) {
    let text = '';
    for (var i = 0; i < list.length; i++) {
      text += list[i].Name + ' - ' + this.getStateString(list[i].State);
      text += '\n';
    }
    return text;
  }

  playerListUpdate(list) {
    this.playerListBox.setText(this.getTextFromPlayerList(list));
  }

  updateLoadout(previousSelection, newSelection) {
    for (let i = 0; i < this.weaponDropdowns.length; i++) {
      let dropdown = this.weaponDropdowns[i];
      let currentData = dropdown.getData('value');
      if (currentData == newSelection) {
        dropdown.setData('value', previousSelection);
        break;
      }
    }
  }
}

const COLOR_PRIMARY = 0x4e342e;
const COLOR_LIGHT = 0x7b5e57;
const COLOR_DARK = 0x260e04;


var CreateDropDownList = function (scene, x, y, options) {
  var maxTextSize = GetMaxTextObjectSize(scene, options);

  var label = scene.rexUI.add.label({
      x: x, y: y,

      background: scene.rexUI.add.roundRectangle(0, 0, 2, 2, 0, COLOR_PRIMARY),

      icon: scene.rexUI.add.roundRectangle(0, 0, 20, 20, 10, COLOR_LIGHT),

      text: CreateTextObject(scene, '')
          .setFixedSize(maxTextSize.width, maxTextSize.height),

      // action:

      space: {
          left: 10,
          right: 10,
          top: 10,
          bottom: 10,
          icon: 10
      }
  })
      .setData('value', '');

  label.data.events.on('changedata-value', function (parent, value, previousValue) {
      label.text = value;
  })
  if (options[0]) {
      label.setData('value', options[0])
  }

  var menu;
  scene.rexUI.add.click(label)
      .on('click', function () {
          if (!menu) {
              var menuX = label.getElement('text').getTopLeft().x,
                  menuY = label.bottom;
              menu = CreatePopupList(scene, menuX, menuY, options, function (button) {
                  let previousData = label.getData('value');
                  let newData = button.text;
                  scene.updateLoadout(previousData, newData);
                  label.setData('value', newData);
                  menu.collapse();
                  menu = undefined;
              });
          } else {
              menu.collapse();
              menu = undefined;
          }
      })
  return label;
}

var CreatePopupList = function (scene, x, y, options, onClick) {
  var items = options.map(function (option) { return { label: option } });
  var menu = scene.rexUI.add.menu({
      x: x,
      y: y,
      orientation: 'y',

      items: items,
      createButtonCallback: function (item, i, options) {
          return scene.rexUI.add.label({
              background: scene.rexUI.add.roundRectangle(0, 0, 2, 2, 0, COLOR_DARK),

              text: CreateTextObject(scene, item.label),

              space: {
                  left: 10,
                  right: 10,
                  top: 10,
                  bottom: 10,
                  icon: 10
              }
          })
      },

      // easeIn: 500,
      easeIn: {
          duration: 500,
          orientation: 'y'
      },

      // easeOut: 100,
      easeOut: {
          duration: 100,
          orientation: 'y'
      }

      // expandEvent: 'button.over'
  });

  menu
      .on('button.over', function (button) {
          button.getElement('background').setStrokeStyle(1, 0xffffff);
      })
      .on('button.out', function (button) {
          button.getElement('background').setStrokeStyle();
      })
      .on('button.click', function (button) {
          onClick(button);
      })

  return menu;
}

var GetMaxTextObjectSize = function (scene, contentArray) {
  var textObject = CreateTextObject(scene, '');
  var width = 0, height = 0;
  for (var i = 0, cnt = contentArray.length; i < cnt; i++) {
      textObject.text = contentArray[i];
      width = Math.max(textObject.width, width);
      height = Math.max(textObject.height, height);
  }
  textObject.destroy();

  return { width: width, height: height };
}

var CreateTextObject = function (scene, text) {
  var textObject = scene.add.text(0, 0, text, {
      fontSize: '20px'
  })
  return textObject;
}