'use strict'

var path = require('path');
var webpack = require('webpack');
var autoprefixer = require('autoprefixer');

module.exports = {
    context: path.resolve('./middlehand/www/modules'),
    entry: {
        'available-agents': './available-agents/available-agents.component',
        'current-queue': './current-queue/current-queue.component',
    },
    output: {
        path: path.join(__dirname, '/middlehand/www/.bin'),
        filename: '[name].bundle.js',
    },
    module: {
        loaders: [
            {
                test: /\.(html|md)$/,
                loader: 'raw-loader'
            },
            {
                test: /\.scss$/,
                loaders: ['style', 'css', 'postcss', 'sass'],
            },
            {
                test: /\.css$/,
                loaders: ['style', 'css', 'postcss'],
            },
        ],
    },
    resolve: {
        extensions: ['', '.js'],
    },
    postcss: function () {
        return [autoprefixer];
    },
}
