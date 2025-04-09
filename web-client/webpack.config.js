const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const Dotenv = require('dotenv-webpack');
const webpack = require('webpack');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';

    return {
        mode: isProduction ? 'production' : 'development',
        devtool: isProduction ? 'source-map' : 'eval-source-map',
        entry: './src/index.js', // Single entry point for the React app
        output: {
            path: path.resolve(__dirname, 'build'), // Output to build directory
            filename: isProduction ? 'static/js/[name].[contenthash:8].js' : 'static/js/bundle.js',
            chunkFilename: isProduction ? 'static/js/[name].[contenthash:8].chunk.js' : 'static/js/[name].chunk.js',
            assetModuleFilename: 'static/media/[name].[hash][ext]',
            clean: true, // Clean the build directory before each build
            publicPath: '/', // Ensure assets are served from the root
        },
        module: {
            rules: [
                {
                    test: /\.(js|jsx)$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        // Babel config now read from .babelrc in the same directory
                    },
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader'], // Simple style-loader for dev, MiniCssExtractPlugin for prod if needed
                },
                {
                    test: /\.(png|svg|jpg|jpeg|gif)$/i,
                    type: 'asset/resource',
                },
            ],
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: './public/index.html', // Use the template from public/
            }),
            new Dotenv({ 
                // path: './.env', // Defaults to .env in the current directory (web-client)
                systemvars: true, // Allow system environment variables to override .env
            }),
            // DefinePlugin can still be useful for injecting NODE_ENV or other build-time vars
            new webpack.DefinePlugin({
                'process.env.NODE_ENV': JSON.stringify(argv.mode),
                // Make sure REACT_APP_ vars from .env are accessible if needed explicitly
                // Dotenv-webpack usually handles process.env access automatically
            }),
        ],
        resolve: {
            extensions: ['.js', '.jsx'],
        },
        devServer: {
            port: 3000, // Standard port for React dev server
            hot: true,
            historyApiFallback: true, // Serve index.html for single-page app routing
            static: {
                directory: path.join(__dirname, 'public')
            },
            // Proxy API requests to the backend server
            proxy: [
                { // Wrap the proxy config in an array
                    context: ['/api'], // Use context for matching
                    target: process.env.REACT_APP_API_URL || 'https://localhost:3443', // Use env var for target
                    secure: false, // Allow self-signed certs for backend
                    changeOrigin: true,
                }
            ]
        },
        // Add performance hints for production builds
        performance: isProduction ? {
            hints: 'warning'
        } : false,
    };
};