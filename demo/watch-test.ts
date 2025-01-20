/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-18 20:10:05
 * @Description: Coding something
 */
import { cmd, ready, require } from 'web-nodejs';

async function main () {
    await ready;
    const fs = require('fs');

    fs.watch('aa', { recursive: true }, (...args) => {
        console.log('watch change', ...args);
    });

    cmd.mv('a.txt', 'aa/a.txt');
}

window.testWatch = main;