/*
 * @Author: chenzhongsheng
 * @Date: 2024-10-10 19:56:55
 * @Description: Coding something
 */
import fs from 'fs-extra';
import { execSync } from 'node:child_process';
import path from 'path';

let packages: string[] = [];
if (process.argv.length > 2) {
    packages = process.argv.slice(2);
} else {
    packages = fs.readdirSync(
        path.resolve(__dirname, '../packages')
    );
}

console.log(packages);
for (const name of packages) {

    if (name === '.DS_Store') continue;

    buildSingle(name);
}

function buildSingle (name: string) {

    console.log(`build ${name} bundle`);
    execSync(`npx vite build -m=sdk_${name}`);

    const base = `packages/${name}`;
    const dist = `${base}/dist`;

    console.log(`build ${name} dts`);
    execSync(concatDts([
        `${dist}/index.d.ts`,
        `${base}/src/index.ts`,
    ]));

    console.log(`build ${name} package`);

    let srcReadme = `${base}/README.md`;

    if (!fs.existsSync(srcReadme)) {
        srcReadme = `README.md`;
    }
    fs.copySync(srcReadme, `${dist}/README.md`);
    fs.copySync('LICENSE', `${dist}/LICENSE`);

    const pkg = require(`${base}/package.json`);
    const mainPkg = require('package.json');
    const iife = `${name}.iife.min.js`;
    const esm = `${name}.es.min.js`;
    const newPkg: any = {
        name: pkg.name,
        version: mainPkg.version,
        unpkg: iife,
        jsdelivr: iife,
        main: esm,
        module: esm,
        typings: `index.d.ts`,
    };
    const pkgs = pkg.dependencies || {};

    if (Object.keys(pkgs).length > 0) {
        for (const key in pkgs) {
            if (key.startsWith('@weoos/')) {
                pkgs[key] = mainPkg.version;
            }
        }
        newPkg.dependencies = pkgs;
    }
    [
        'description', 'repository', 'keywords', 'author',
        'license', 'bugs', 'homepage', 'publishConfig'
    ].forEach(name => {
        newPkg[name] = pkg[name] || mainPkg[name] || '';
    });

    fs.writeFileSync(`${dist}/package.json`, JSON.stringify(newPkg, null, 4));

    const afterBuild = `${base}/after-build.js`;

    if (fs.existsSync(afterBuild)) {
        execSync(`node ${afterBuild}`);
    }

    execSync(`npx vite build -m=iife_${name}`);
}


function concatDts (io) {
    return [
        'npx dts-bundle-generator -o',
        ...io,
        '--no-check',
        '--no-banner',
        // '--external-inlines',
        // 'localforage', // 合并第三方包的dts信息
    ].join(' ');
}