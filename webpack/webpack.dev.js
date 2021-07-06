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
      '/socket.io': 'http://localhost:3000',
    }
  }
}

//module.exports = merge(common, dev)
export default merge(common, dev)
