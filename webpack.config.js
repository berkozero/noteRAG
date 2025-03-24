const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
    mode: 'development',
    devtool: 'cheap-source-map',
    entry: {
        'pages/Popup/Popup': path.join(__dirname, 'src', 'pages', 'Popup', 'Popup.js'),
        'pages/Login/Login': path.join(__dirname, 'src', 'pages', 'Login', 'Login.js'),
        'pages/Background/Background': path.join(__dirname, 'src', 'pages', 'Background', 'Background.js'),
        'services/auth/auth': path.join(__dirname, 'src', 'services', 'auth', 'auth.js'),
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
                { 
                    from: "src/manifest.json",
                    to: "manifest.json",
                    transform(content) {
                        // Prevents webpack from modifying the manifest
                        return content;
                    },
                },
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