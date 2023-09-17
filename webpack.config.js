const Path = require("path");
const ESLintPlugin = require("eslint-webpack-plugin");


module.exports = () => {
    const isProduction = process.env.NODE_ENV === "production";

    console.log("isProduction", isProduction);

    const config = {
        target: "node",
        // context: path.resolve(__dirname, "src"),
        entry: "./src/index.ts",
        output: {
            path: Path.resolve(__dirname, "dist"),
            filename: "index.js"
        },
        optimization: {
            minimize: false,
            providedExports: false,
            concatenateModules: false
        },
        plugins: [
            new ESLintPlugin({
                overrideConfigFile: __dirname + "/.eslintrc.js"
            }),
            // new EmitAllPlugin({
            //     ignorePattern: /node_modules/, // default
            //     path: path.join(__dirname, "dist-unbundled")
            // })
            // Add your plugins here
            // Learn more about plugins from https://webpack.js.org/configuration/plugins/
        ],
        module: {
            rules: [
                {
                    test: /\.(js|jsx|ts|tsx)$/i,
                    loader: "babel-loader",
                    exclude: ["/node_modules/"]
                },
                // {
                //     test: /\.(eot|svg|ttf|woff|woff2|png|jpg|gif)$/i,
                //     type: "asset"
                // },

                // Add your rules for custom modules here
                // Learn more about loaders from https://webpack.js.org/loaders/
            ],
        },
        resolve: {
            extensions: [".tsx", ".ts", ".js"]
        }
    };

    if(isProduction) {
        config.mode = "production";
    }
    else {
        config.mode = "development";
    }

    return config;
};