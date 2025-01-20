/*
 * @Author: chenzhongsheng
 * @Date: 2025-01-16 21:31:07
 * @Description: Coding something
 */
const fs = require('fs');
const path = require('path');


const list = fs.readdirSync(
    path.resolve(__dirname, '../packages')
);


for (const name of list) {
    const p = path.resolve(__dirname, `../packages/${name}`);
    if (!fs.statSync(p).isDirectory()) continue;
    const pkg = require(`${p}/package.json`);

    const dependencies = pkg.dependencies || {};

    if (Object.keys(dependencies).length === 0) continue;


    const config = require(`${p}/tsconfig.json`);
    const types = config.compilerOptions.types;

    let mod = false;
    for (const key in dependencies) {
        if (dependencies[key] === 'workspace:*') {
            const v = `../${key.replace('@weoos/', '')}`;
            if (types.includes(v)) continue;
            types.push(v);
            mod = true;
        }
    }

    const nodeTypes = '@types/node';
    if (!types.includes(nodeTypes)) {
        types.push(nodeTypes);
        mod = true;
    }

    if (mod) {
        fs.writeFileSync(`${p}/tsconfig.json`, JSON.stringify(config, null, 2));
        console.log(name, config.compilerOptions.types);
    }

}