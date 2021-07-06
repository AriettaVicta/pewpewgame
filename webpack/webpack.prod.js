//const { merge } = require('webpack-merge')
import mergepkg from 'webpack-merge';
const {merge} = mergepkg;
//const common = require('./webpack.common')
import common from './webpack.common.js';
//const WebpackObfuscator = require('webpack-obfuscator')

const prod = {
  mode: 'production',
  output: {
    filename: '[name].[contenthash].bundle.js',
    chunkFilename: '[name].[contenthash].chunk.js'
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        commons: {
          filename: '[name].[contenthash].bundle.js'
        }
      }
    }
  },
  plugins: [
    // disabled by default (uncomment to active)
    // new WebpackObfuscator(
    //   {
    //     rotateStringArray: true,
    //     stringArray: true,
    //     stringArrayThreshold: 0.75
    //   },
    //   ['vendors.*.js', 'sw.js']
    // )
  ]
}

//module.exports = merge(common, prod)
export default merge(common, prod)
