// chrome-extension/webpack.config.js
const path = require('path');

module.exports = {
  entry: {
    popup: './src/popup.js', // Entry point for popup code
    background: './src/background.js' // Entry point for background script
  },
  output: {
    path: path.resolve(__dirname, 'dist'), // Output directory
    filename: '[name].js', // Output file names (popup.js, background.js)
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-react'] // Use React preset
          }
        }
      }
    ]
  },
  mode: 'development', // Use 'development' for easier debugging, 'production' for release
  devtool: 'cheap-module-source-map' // Add source maps for debugging
}; 