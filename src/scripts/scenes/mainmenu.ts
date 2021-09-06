import { ServerPlayerState } from '../../shared/enums';
import TextButton from '../objects/textbutton';
import SocketManager from '../socket/socketmanager';
import VirtualJoyStick from 'phaser3-rex-plugins/plugins/virtualjoystick.js';
import EnergyBar from '../objects/energybar';

export default class MainMenuScene extends Phaser.Scene {

  quickMatchButton : TextButton;
  howToPlayButton : TextButton;

  peer1 : TextButton;
  peer2 : TextButton;
  peerMessage : TextButton;

  nameBox;
  changedNameTimer : number;

  playerListBox : Phaser.GameObjects.Text;

  game : any;

  constructor() {
    super({ key: 'MainMenuScene' })
  }


  create() {
    var self = this;

    if (!self.game.socketManager) {
      self.game.socketManager = new SocketManager();
    }
    self.game.socketManager.setCurrentScene(this);

    this.quickMatchButton = new TextButton(this, 200, 250, 'Quickmatch', () => {
      self.scene.start('GameplayScene')
    }, false, null)
    this.howToPlayButton = new TextButton(this, 200, 400, 'How to Play', () => {
      self.scene.start('HowToPlayScene')
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
}
