const { merge } = require('webpack-merge');
const common = require('./webpack.config.common');
const webpack = require('webpack');

const config = merge(common, {
    mode: 'production',

    plugins: [
        new webpack.DefinePlugin({
            BUILD_CONFIG: JSON.stringify({}),
        }),
    ],
});

module.exports = config;
