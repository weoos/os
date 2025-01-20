/*
 * @Author: chenzhongsheng
 * @Date: 2024-11-30 11:29:50
 * @Description: Coding something
 */
// const {
//     b, a
// } = require('./test');

// require('');

// const fs = require('fs').promises;

// fs.readFile('./1.js');

// const $$text = fs.readFileSync('./1.js');


const path = require('path');


console.log(path.join('', '/a/b'));
console.log(path.join('a/b', 'a/b'));
console.log(path.join('a/b', '/a/b'));
console.log(path.join('a/b', '..'));
console.log(path.join('a/b', '../c'));
console.log(path.join('a/b/c', '../..'));
console.log(path.join('a/b/c', './d'));