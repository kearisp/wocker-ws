#!/usr/bin/env node

const chalk = require("chalk");
const {app} = require("../lib/index.js");


app.run().then((res) => {
    if(res) {
        process.stdout.write(res);
    }
}).catch((err) => {
    console.error(chalk.red(err.message));
});
