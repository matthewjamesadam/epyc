const { merge } = require('webpack-merge');
const common = require('./webpack.config.common');
const webpack = require('webpack');

const config = merge(common, {
    mode: 'development',
    devtool: 'eval-source-map',

    devServer: {
        historyApiFallback: true,
    },

    plugins: [
        new webpack.DefinePlugin({
            BUILD_CONFIG: JSON.stringify({
                API_BASE: 'http://localhost:3001/api',
            }),
        }),
    ],
});

module.exports = config;
