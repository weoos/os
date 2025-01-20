/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-10 23:30:55
 * @Description: Coding something
 */

import { ready } from 'web-nodejs';

async function main () {
    await ready;

    const https = require('https');

    const server = https.createServer((req, res) => {
        res.write('<div>11</div>');
        res.write('<div>22</div>');
        res.end();
    }).listen(3002);

    window.fs = require('fs');

}

main();