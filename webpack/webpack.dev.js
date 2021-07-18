//const { merge } = require('webpack-merge')
import mergepkg from 'webpack-merge';
const {merge} = mergepkg;
//const common = require('./webpack.common')
import common from './webpack.common.js';

const dev = {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    //open: true,
    proxy: {
      '/socket.io': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
}

//module.exports = merge(common, dev)
export default merge(common, dev)
