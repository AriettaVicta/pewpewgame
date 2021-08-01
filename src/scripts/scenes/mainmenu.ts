import TextButton from '../objects/textbutton';
import SocketManager from '../socket/socketmanager';

declare var Phaser : any;

export default class MainMenuScene extends Phaser.Scene {

  quickMatchButton : TextButton;
  howToPlayButton : TextButton;

  nameBox;
  changedNameTimer : number;

  constructor() {
    super({ key: 'MainMenuScene' })
  }

  create() {
    var self = this;

    if (!self.game.socketManager) {
      self.game.socketManager = new SocketManager();
    }
    self.game.socketManager.setCurrentScene(this);

    this.quickMatchButton = new TextButton(this, 400, 400, 'Quickmatch', () => {
      self.scene.start('GameplayScene')
    })
    this.howToPlayButton = new TextButton(this, 400, 500, 'How to Play', () => {
      self.scene.start('HowToPlayScene')
    })

    this.add.text(400, 300,
      'Name:', { 
      color: 'white',
      fontSize: '32px',
    }).setOrigin(0, 0);
    
    self.nameBox = this.add.dom(520, 300).createElement('input').setOrigin(0,0);
    self.nameBox.node.style.fontSize = '24px';
    self.nameBox.node.style.pointerEvents = 'auto';
    self.nameBox.node.value = this.game.socketManager.getPlayerName();
    self.nameBox.node.maxLength = 15;
    self.nameBox.addListener('keydown');

    self.nameBox.on('keydown', function (event) {
      self.changedNameTimer = Date.now();
    });
  }
  
  update(time, delta) {
    if (this.changedNameTimer) {
      if (Date.now() - this.changedNameTimer > 1000) {
        this.changedNameTimer = 0;
        if (this.nameBox.node.value != '' && this.nameBox.node.value != this.game.socketManager.getPlayerName()) {
          console.log('submit player name');
          this.game.socketManager.updatePlayerName(this.nameBox.node.value);
          //localStorage.setItem('playername', self.nameBox.node.value);
        }
      }
    }
  }

  nameUpdate(newName) {
    this.nameBox.node.value = newName;
  }
}
