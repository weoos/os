/*
 * @Author: chenzhongsheng
 * @Date: 2024-11-24 22:17:00
 * @Description: Coding something
 */


// import {} from '@types/node/buffer.buffer';
// import { BufferConstructor } from '@types/node';
// import { kStringMaxLength } from 'buffer';
// import { execSync } from 'child_process';

// BufferConstructor;

// Buffer.isEncoding;

// execSync;

// kStringMaxLength;

// module.exports = {
//     b: 1
// };

// exports.a = {};

// const { readFile } = require('fs').promises;

// const buffer = Buffer.from('123', 'utf8');

// console.log(new Uint8Array(buffer));
// console.log(Buffer.from().toString('utf8'));

const fs = require('fs');
// fs.watch
// console.log(fs.readFileSync('./1.js', 'binary'));

// console.log(fs.lstatSync('./1.js'));

// exports.default = 1;


// fs.watchFile('1.js', (a, b, c) => {
//     console.log(a, b, c);
// });

// fs.watch('test', { recursive: true }, (a, b) => {
//     console.log(a, b);
// });

fs.renameSync('test/a1.txt', 'a2.txt');