const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
    mode: 'development',
    devtool: 'cheap-source-map',
    entry: {
        'background/background': './src/background/background.js',
        'pages/Popup/Popup': './src/pages/Popup/Popup.js',
        'services/auth/auth': './src/services/auth/auth.js',
        'pages/Login/Login': './src/pages/Login/Login.js'
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        clean: true
    },
    optimization: {
        minimize: false
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: "src/manifest.json", to: "manifest.json" },
                { 
                    from: "src/pages/Popup",
                    to: "pages/Popup",
                    globOptions: {
                        ignore: ["**/*.js"]
                    }
                },
                { 
                    from: "src/pages/Login",
                    to: "pages/Login",
                    globOptions: {
                        ignore: ["**/*.js"]
                    }
                },
                { from: "src/assets", to: "assets" }
            ],
        }),
    ],
};