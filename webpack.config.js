const webpack = require('webpack');
const config = require('./package.json');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const WebpackUploadPlugin = require('jdf2e-webpack-upload-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const autoprefixer = require('autoprefixer');
const htmlwebpackincludeassetsplugin = require('html-webpack-include-assets-plugin');
const AddAssetHtmlPlugin = require('add-asset-html-webpack-plugin');
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const PrerenderSPAPlugin = require('prerender-spa-plugin');
const Renderer = PrerenderSPAPlugin.PuppeteerRenderer;
const cheerio = require('cheerio');


const webpackConfig = module.exports = {};
const isProduction = process.env.NODE_ENV === 'production';
const isUpload = process.env.NODE_ENV === 'upload';

const curDate = new Date();
const curTime = curDate.getFullYear() + '/' + (curDate.getMonth() + 1) + '/' + curDate.getDate() + ' ' + curDate.getHours() + ':' + curDate.getMinutes() + ':' + curDate.getSeconds();

const bannerTxt = config.name + ' ' + config.version + ' ' + curTime; //构建出的文件顶部banner(注释)内容

webpackConfig.entry = {
    app: './src/app.js',
};

webpackConfig.output = {
    path: path.resolve(__dirname, 'build'),
    publicPath: '/',
    filename: config.version+'/js/[name].js'
};

webpackConfig.module = {
    rules: [{
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
            fallback: "style-loader",
            use: [ 'css-loader?-minimize', 'postcss-loader']
        }),
    }, {
        test: /\.scss$/,
        use: ExtractTextPlugin.extract({
            fallback: 'style-loader',
            use: [ 'css-loader?-minimize', 'sass-loader', 'postcss-loader']

        })
    }, {
        test: /\.vue$/,
        use:[
            {
                loader:'vue-loader',
                options:{
                    loaders:{
                          sass:ExtractTextPlugin.extract({
                            fallback: 'vue-style-loader',
                            use:'css-loader?-minimize!sass-loader'
                        })
                    },
                    postcss: [require('autoprefixer')()]
                }
            }
        ]
    }, {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
    },  {
        test: /\.svg$/,
        loader: 'svg-sprite-loader'
    }, {
        test: /\.(png|jpg|gif|webp)$/,
        loader: 'url-loader',
        options: {
            limit: 3000,
            name: 'img/[name].[ext]',
        }
    }, ]
};

webpackConfig.plugins = [
    new webpack.optimize.ModuleConcatenationPlugin(),
    new CleanWebpackPlugin('build'),
    new HtmlWebpackPlugin({
        template: './src/index.html',
        filename: path.resolve(__dirname, 'build/index.html'),
    }),
    new ExtractTextPlugin({
        filename: config.version+'/css/app.css'
    }),
    new OptimizeCssAssetsPlugin({
      assetNameRegExp: /\.css\.*(?!.*map)$/g,
      cssProcessorOptions: { 
        discardComments:{removeAll:true},
        safe: true,
        autoprefixer:false,
      },
     
    }),
    new CopyWebpackPlugin([
        { from: path.join(__dirname, "./static/"), to: path.join(__dirname, "./build/lib") }
    ]),
    new webpack.DllReferencePlugin({
        context:__dirname,
        manifest:require('./vendor-manifest.json')
    })
];

if (isProduction || isUpload) {

    webpackConfig.plugins = (webpackConfig.plugins || []).concat([
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: '"production"'
            }
        }),
        new webpack.LoaderOptionsPlugin({
            minimize: true
        }),
        new UglifyJsPlugin({
            cache:true,
            sourceMap:false,
            parallel:4,
            uglifyOptions: {
                ecma:8,
                warnings:false,
                compress:{
                    drop_console:true,
                },
                output:{
                    comments:false,
                    beautify:false,
                }
            }
            
        }),
        new htmlwebpackincludeassetsplugin({
            assets:['lib/vendor.dll.js'],
            publicPath:'/',
            append:false
            
        }),

        new webpack.BannerPlugin(bannerTxt),
        new PrerenderSPAPlugin({
            staticDir: path.join(__dirname, 'build'),
            routes: [ '/','/detail','/detail2' ],
            postProcess(renderedRoute){
                const $ = cheerio.load(renderedRoute.html);
                $('html').removeAttr('style');
                let cssHref = $('link').attr('href');
                $('link').attr('href',config.publicPath+cssHref);

                //script
                let scriptStr = '';
                $('script','body').map(function(i,el){
                    let src = $(this).attr('src');
                    if( src &&src.indexOf('//') == -1){
                        $(this).attr('src',config.publicPath+ src);
                        
                    }
                    scriptStr += $(this).clone();
                })
                let appContent =  $('#app').clone();

                let body = $('body');
                body.empty();
                $(appContent).appendTo(body);
                $(scriptStr).appendTo(body);
                renderedRoute.html = $.html();
                return renderedRoute;
            },
            renderer: new Renderer({
             
              inject: {
                foo: 'bar'
              },
              renderAfterDocumentEvent: 'render-event',
    
            })
          })
    ]);
    if (isUpload) {
        webpackConfig.plugins = (webpackConfig.plugins || []).concat([
            new WebpackUploadPlugin({
                host: "{{uploadHost}}",//上传服务器地址
                source: 'build',
                serverDir: config.ftpServer,
                target: config.ftpTarget
            })
        ]);
    }
} else {
    webpackConfig.output.publicPath = '/';
    webpackConfig.devtool = '#cheap-module-eval-source-map';
    webpackConfig.plugins = (webpackConfig.plugins || []).concat([
         new AddAssetHtmlPlugin({
            filepath:require.resolve('./static/vendor.dll.js'),
            includeSourcemap:false,
            
        })
    ]);
    webpackConfig.devServer = {
        contentBase: path.resolve(__dirname, 'build'),
        compress: true, //gzip压缩
        historyApiFallback: true,
    };
}