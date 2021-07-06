//const path = require('path')
import path from 'path';
//const CopyWebpackPlugin = require('copy-webpack-plugin')
import CopyWebpackPlugin from 'copy-webpack-plugin';
//const HtmlWebpackPlugin = require('html-webpack-plugin')
import HtmlWebpackPlugin from 'html-webpack-plugin';
//const { InjectManifest } = require('workbox-webpack-plugin')
import workbox from 'workbox-webpack-plugin'
const {InjectManifest} = workbox;
//const webpack = require('webpack')
import webpack from 'webpack';

var __dirname = import.meta.url;
__dirname = __dirname.replace("file:///", "");
__dirname = __dirname.replace("/webpack.common.js", "");
console.log('DIRNAME USED: ' + __dirname);

//module.exports = {
const config = {
  entry: ['./src/scripts/game.ts', './webpack/credits.js'],
  output: {
    path: path.resolve(__dirname, '../dist'),
    filename: '[name].bundle.js',
    chunkFilename: '[name].chunk.js'
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js']
  },
  module: {
    rules: [{ 
      test: /\.ts|\.tsx?$|\.jsx?$/, 
      include: path.join(__dirname, '../src'), 
      loader: 'ts-loader' 
    }]
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        commons: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          filename: '[name].bundle.js'
        }
      }
    }
  },
  plugins: [
    new webpack.ProgressPlugin(),
    new HtmlWebpackPlugin({ gameName: 'My Phaser Game', template: 'src/index.html' }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/assets', to: 'assets' },
        { from: 'pwa', to: '' },
        { from: 'src/favicon.ico', to: '' }
      ]
    }),
    new InjectManifest({
      swSrc: path.resolve(__dirname, '../pwa/sw.js'),
      swDest: 'sw.js'
    })
  ]
}
export default config;