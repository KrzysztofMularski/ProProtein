const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

function createEntry() {
    return {
        target: void 0,
        entry: path.resolve(__dirname, 'src/molstar/lib/coloring/index.js'),
        output: { filename: 'index.min.js', path: path.resolve(__dirname, 'public/molstar_bundle') },
        module: {
            rules: [
                {
                    test: /\.(html|ico)$/,
                    use: [{
                        loader: 'file-loader',
                        options: { name: '[name].ejs' }
                    }]
                },
                {
                    test: /\.(s*)css$/,
                    use: [
                        MiniCssExtractPlugin.loader,
                        { loader: 'css-loader', options: { sourceMap: false } },
                        { loader: 'sass-loader', options: { sourceMap: false } },
                    ]
                }
            ]
        },
        plugins: [
            new MiniCssExtractPlugin({ filename: 'molstar.css' }),
        ],
        resolve: {
            modules: [
                'node_modules',
                'lib',
                path.resolve(__dirname, 'lib/')
            ],
            fallback: {
                fs: false,
            }
        },
        watchOptions: {
            aggregateTimeout: 750
        }
    }
}

module.exports = [
    createEntry()
];
