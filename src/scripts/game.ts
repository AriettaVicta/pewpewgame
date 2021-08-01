import 'phaser'
import GameplayScene from './scenes/gameplayscene'
import PreloadScene from './scenes/preloadScene'
import MainMenuScene from './scenes/mainmenu';
import HowToPlayScene from './scenes/howtoplayscene';

const DEFAULT_WIDTH = 1280
const DEFAULT_HEIGHT = 720

const config = {
  type: Phaser.AUTO,
  backgroundColor: '#000000',
  scale: {
    parent: 'phaser-game',
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT
  },
  scene: [PreloadScene, MainMenuScene, GameplayScene, HowToPlayScene],
  dom: {
    createContainer: true
  },
  callbacks: {
    postBoot: function(game) {
      game.domContainer.style.pointerEvents = 'none';
    },
  },
}

window.addEventListener('load', () => {
  const game = new Phaser.Game(config)
})
