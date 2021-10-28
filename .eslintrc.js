module.exports = {
    root: true,
    // parser: "@babel/eslint-parser",
    parser: "@typescript-eslint/parser",
    parserOptions: {
        tsconfigRootDir: __dirname,
        project: "./tsconfig.json",
        // ecmaVersion: 12,
        // sourceType: "module",
        ecmaVersion: "latest",
        sourceType: "module"
    },
    globals: {
        NodeJS: true,
        BufferEncoding: true
    },
    env: {
        browser: false,
        es6: true,
        node: true
    },
    plugins: [
        "@typescript-eslint",
        "@babel",
        "node"
    ],
    extends: [
        "eslint:recommended",
        // "plugin:@typescript-eslint/recommended",
        // "plugin:import/typescript",
    ],
    ignorePatterns: [
        "bin/*",
        "**/*.spec.ts",
        "node_modules/*",
        "packages/*",
        "lib/*",
        "test/*",
        ".eslintrc.js",
        "jest.config.ts",
        "webpack.config.js"
    ],
    rules: {
        "no-dupe-class-members": 0,
        "no-unused-vars": 0,
        "@typescript-eslint/ban-ts-comment": 0
    },
    settings: {
        "import/resolver": {
            "eslint-import-resolver-custom-alias": {
                "alias": {
                    "@app": "./src"
                },
                "extensions": [".ts"]
            }
        }
    }
};
