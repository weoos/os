/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-10 23:10:07
 * @Description: Coding something
 */
const http = require('http');


http.createServer((req, res) => {
    console.log(req.url);
    res.write('<div>11</div>');
    res.end();
}).listen(3002);