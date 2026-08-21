const path = require( 'path' );
const webpack = require( 'webpack' );
const fs = require( 'fs' );
const pkg = require( './package.json' );

// Pull the base background straight out of the stylesheet so the critical
// inline style in index.html can never drift from the compiled CSS.
//
// Anchored to the start of a line so a commented-out declaration cannot win,
// and the captured value is validated below: it is interpolated raw into a
// <style> block, where every way it can go wrong -- a `!default` flag, a value
// that is itself a variable, the declaration being renamed or moved into a
// partial -- produces a build that silently paints white on first load and
// snaps to the real colour. Better to fail the build than ship that.
const baseBackgroundMatch = fs
    .readFileSync( path.resolve( __dirname, './sources/scss/gvp.scss' ), 'utf8' )
    .match( /^[ \t]*\$default-bg-color:\s*([^;]+);/m );

const baseBackground = baseBackgroundMatch ? baseBackgroundMatch[ 1 ].trim() : null;

if ( !baseBackground || !/^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]+\))$/.test( baseBackground ) ) {
    throw new Error(
        'webpack.common.js: expected a literal colour from $default-bg-color in sources/scss/gvp.scss, got '
        + JSON.stringify( baseBackground ) + '. The critical inline background in index.html depends on it.'
    );
}

// One timestamp for the whole build. Two independent new Date() calls could
// straddle midnight and stamp two different dates into one artifact, and
// toISOString() is UTC -- which labelled a late-afternoon US Central build with
// tomorrow's date.
const BUILD_DATE = ( () => {

    const d = new Date();

    return [
        d.getFullYear(),
        String( d.getMonth() + 1 ).padStart( 2, '0' ),
        String( d.getDate() ).padStart( 2, '0' )
    ].join( '-' );

} )();
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
        // The version is defined once, in package.json, and injected from there:
        // into index.html (data-version), into the bundle as __GVP_VERSION__,
        // and into the banner comment at the top of the built file.
        new HtmlWebpackPlugin( {
            template: 'index.html',
            filename: path.resolve( __dirname, 'dist', 'index.html' ),
            templateParameters: {
                version: pkg.version,
                baseBackground: baseBackground
            },
        } ),
        new webpack.DefinePlugin( {
            __GVP_VERSION__: JSON.stringify( pkg.version ),
        } ),
        new webpack.BannerPlugin( {
            banner: `/*! Generic Video Player ${pkg.version} | built ${BUILD_DATE} | ${pkg.homepage} | ${pkg.license} */`,
            raw: true,
            entryOnly: true,
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
                    './sources/scripts/videojs/plugins/markers/videojs-markers.js'
                    // videojs-resolution-switcher was retired in favour of the
                    // in-house quality menu (setupQualityMenu in gvp-dev.js).
                    // youtube.min.js is deliberately NOT bundled here: it is only
                    // needed for YouTube-sourced videos and is fetched on demand
                    // (see loadYouTubeTech in gvp-dev.js). Bundling it also made
                    // every Kaltura page pull youtube.com/iframe_api for nothing.
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