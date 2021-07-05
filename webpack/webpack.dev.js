const { merge } = require('webpack-merge')
const common = require('./webpack.common')

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

module.exports = merge(common, dev)
