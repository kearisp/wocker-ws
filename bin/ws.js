#!/usr/bin/env node

const chalk = require("chalk");
const {app} = require("../lib/main.js");


app.run(process.argv).then((res) => {
    if(!res) {
        return;
    }

    process.stdout.write(res);
}).catch((err) => {
    console.error(chalk.red(err.message));

    throw err;
});
