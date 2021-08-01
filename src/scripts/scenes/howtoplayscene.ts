import TextButton from '../objects/textbutton';

export default class HowToPlayScene extends Phaser.Scene {

  mainMenuButton : TextButton;

  constructor() {
    super({ key: 'HowToPlayScene' })
  }

  create() {
    var self = this;

    this.mainMenuButton = new TextButton(this, 400, 100, 'Main Menu', () => {
      self.scene.start('MainMenuScene')
    })
    this.add.text(100, 200,
      'WSAD to move\n \
       Click or Spacebar to shoot\n \
       Mouse to aim (only weapon 2 right now)\n \
       1-2 Select weapon \
      ', { 
      color: 'white',
      fontSize: '32px',
      wordWrap: { width: 1000, useAdvancedWrap: true }
    }).setOrigin(0, 0);
  }
}
