import TextButton from '../objects/textbutton';

export default class MainMenuScene extends Phaser.Scene {

  quickMatchButton : TextButton;

  constructor() {
    super({ key: 'MainMenuScene' })
  }

  create() {
    var self = this;

    this.quickMatchButton = new TextButton(this, 400, 400, 'Quickmatch', () => {
      self.scene.start('GameplayScene')
    })
  }
}
