/*
 * @Author: chenzhongsheng
 * @Date: 2025-01-22 00:38:09
 * @Description: Coding something
 */

import { execSync } from 'node:child_process';
import { traversePackages } from './utils';

traversePackages(name => {
    pubSingle(name);
});

function pubSingle (name: string) {
    console.log(`publish ${name}`);
    const data = execSync(`cd ./packages/${name}/dist && npm publish --access=public`);
    console.log(data.toString('utf-8'));
}