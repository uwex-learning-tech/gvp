const path = require( 'path' );
const HtmlWebpackPlugin = require( 'html-webpack-plugin' );
const MiniCssExtractPlugin = require( 'mini-css-extract-plugin' );
const CopyWebpackPlugin = require( 'copy-webpack-plugin' );
const WebpackConcatPlugin = require('webpack-concat-files-plugin');
const terser = require('terser');

module.exports = {

    entry: {
        'gvp' : path.resolve(__dirname, './sources/scripts/gvp-dev.js')
    },
    output: {
        filename: 'sources/scripts/[name].js',
        path: path.resolve( __dirname, 'dist' ),
        clean: true,
    },
    optimization: {
        splitChunks: {
            cacheGroups: {
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendor',
                    chunks: 'all',
                },
            },
        },
    },
    module: {
        rules: [
            {
                test: /\.(sa|sc|c)ss$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    "css-loader",
                    "postcss-loader",
                    {
                        loader: 'sass-loader',
                        options: {
                          // Prefer `dart-sass`
                          implementation: require.resolve('sass'),
                        },
                    },
                ],
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin( {
            template: 'index.html',
            filename: path.resolve( __dirname, 'dist', 'index.html' ),
        } ),
        new CopyWebpackPlugin( {
            patterns: [
                {
                    from: 'gvp.xml'
                },
                {
                    from: 'iframe.html'
                },
                {
                    from: 'sources/manifest.json',
                    to: 'sources'
                },
                {
                    from: 'sources/scripts/templates',
                    to: 'sources/scripts/templates'
                },
                {
                    from: 'sources/scripts/videojs/font',
                    to: 'sources/scripts/videojs/font'
                },
                {
                    from: 'sources/scripts/videojs/lang',
                    to: 'sources/scripts/videojs/lang'
                },
                {
                    from: 'sources/scripts/videojs/video-js.css',
                    to: 'sources/scripts/videojs/'
                },
                {
                    from: 'sources/scripts/kwidget.getsources.js',
                    to: 'sources/scripts/'
                },
                {
                    from: 'sources/scripts/mwembedloader.js',
                    to: 'sources/scripts'
                }
            ],
        } ),
        new WebpackConcatPlugin({
            bundles: [
              {
                dest: './dist/sources/scripts/videojs/video.js',
                src: [
                    './sources/scripts/videojs/video.js',
                    './sources/scripts/videojs/plugins/markers/videojs-markers.js',
                    './sources/scripts/videojs/plugins/resolution/videojs-resolution-switcher.js',
                    './sources/scripts/videojs/plugins/youtube/youtube.min.js'
                ],
                transforms: {
                    after: async (code) => {
                      const minifiedCode = await terser.minify(code);
                      return minifiedCode.code;
                    },
                },
              },
            ],
        }),
        new MiniCssExtractPlugin({
            filename: 'sources/css/[name].css',
            chunkFilename: 'sources/css/[id].css',
        } ),
    ],

};