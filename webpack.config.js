const path = require('path');
const Dotenv = require('dotenv-webpack');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
require('dotenv').config();

module.exports = {
    mode: 'development',
    devtool: 'cheap-source-map',
    entry: {
        'pages/Popup/Popup': path.join(__dirname, 'src', 'pages', 'Popup', 'Popup.js'),
        'pages/Login/Login': path.join(__dirname, 'src', 'pages', 'Login', 'Login.js'),
        'pages/Background/Background': path.join(__dirname, 'src', 'pages', 'Background', 'index.js'),
        'services/auth/auth': path.join(__dirname, 'src', 'services', 'auth', 'auth.js'),
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        clean: true
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [MiniCssExtractPlugin.loader, 'css-loader'],
            },
        ],
    },
    optimization: {
        minimize: false,
        splitChunks: false, // Disable code splitting
    },
    plugins: [
        new Dotenv(),
        new MiniCssExtractPlugin({
            filename: '[name].css',
        }),
        new CopyPlugin({
            patterns: [
                { 
                    from: "src/manifest.json",
                    to: "manifest.json",
                    transform(content) {
                        // Replace the client ID placeholder with actual value
                        const manifest = JSON.parse(content.toString());
                        manifest.oauth2.client_id = process.env.GOOGLE_CLIENT_ID;
                        return JSON.stringify(manifest, null, 2);
                    },
                },
                { 
                    from: "src/pages/Popup",
                    to: "pages/Popup",
                    globOptions: {
                        ignore: ["**/*.js", "**/*.css"]
                    }
                },
                { 
                    from: "src/pages/Login",
                    to: "pages/Login",
                    globOptions: {
                        ignore: ["**/*.js", "**/*.css"]
                    }
                },
                { from: "src/assets", to: "assets" }
            ],
        }),
    ],
    resolve: {
        extensions: ['.js', '.jsx'],
    },
};