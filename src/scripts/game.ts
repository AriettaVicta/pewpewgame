import 'phaser'
import GameplayScene from './scenes/gameplayscene'
import PreloadScene from './scenes/preloadScene'
import MainMenuScene from './scenes/mainmenu';
import HowToPlayScene from './scenes/howtoplayscene';

import UIPlugin from 'phaser3-rex-plugins/templates/ui/ui-plugin.js';

const DEFAULT_WIDTH = 1580
const DEFAULT_HEIGHT = 920

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
  plugins: {
    scene: [{
      key: 'rexUI',
      plugin: UIPlugin,
      mapping: 'rexUI',
    }]
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
