const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

const config = {
    context: path.resolve(__dirname),
    entry: './App.tsx',
    output: {
        path: path.resolve(__dirname, '.build'),
        filename: 'app.js',
        publicPath: '/',
    },
    module: {
        rules: [
            {
                test: /\.scss$/,
                use: [
                    'style-loader',
                    'css-loader',
                    {
                        loader: 'postcss-loader',
                        options: {
                            postcssOptions: {
                                plugins: ['autoprefixer'],
                            },
                        },
                    },
                    'sass-loader',
                ],
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.tsx?$/,
                use: {
                    loader: 'ts-loader',
                },
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './index.html',
        }),
        new CopyPlugin({
            patterns: [{ from: path.resolve(__dirname, 'public') }],
        }),
    ],

    resolve: {
        extensions: ['.ts', '.tsx', '.js'],
    },
};

module.exports = config;
