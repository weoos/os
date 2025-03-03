/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-05 19:43:00
 * @Description: Coding something
 */
import * as PathBrowserify from 'path-browserify';
import type { NodePath } from './types';
import { splitPathInfo } from '@weoos/utils';

export const pt = PathBrowserify as NodePath;

export { splitPathInfo } from '@weoos/utils';

export function splitPath (path: string): [string[], string] {
    path = clearPath(path);

    if (!path) return [ [], '' ];

    const paths = path.split('/');
    if (paths[0] === '') paths.shift();
    const tail = paths.pop()!;
    return [ paths, tail ];
}

export function clearPath (path: string, tail = false) {
    path = path.trim();

    path = path.replace(/(^\/*)|(\/*$)/g, ''); // 去除首位的 /
    path = path.replace(/\/+/g, '/'); // 去除重复的 /
    if (!path) return '/';
    path = `/${path}`;
    return tail ? `${path}/` : path;
}

// clearedPath

export function getParentPath (path): string {
    return splitPathInfo(path).parent;
}

// window.getParentPath = getParentPath;

export function getFileName (path: string) {
    return getLastSplit(path, '/');
}

export function getFileExt (path: string) {
    return getLastSplit(path, '.');
}

function getLastSplit (path: string, split: string) {
    path = clearPath(path);
    const index = path.lastIndexOf(split);
    if (index === -1) return path;
    return path.substring(index + 1);
}

// ! 处理粘贴过来的文件名
export function handlePasteFileNames (
    source: string[], // 复制的完整路径
    targetDir: string, // 粘贴目标目录的完整路径
    current: string[], // 当前文件夹所有文件名
    // renameMap 用于修改源文件名 用于 fs.rename 方法
    renameMap?: Record<string, string>, // {oldNameFull: newNameFull}
): Record<string, string> { // 返回新旧文件名 {旧路径: 新路径}
    const curSet = new Set(current);
    const result: Record<string, string> = {};
    for (const srcPath of source) {
        const srcTruePath = renameMap?.[srcPath] || srcPath;
        const { name } = splitPathInfo(srcTruePath);
        const newName = curSet.has(name) ?
            renameWhenConflict(name, curSet) :
            name;
        curSet.add(newName);
        result[srcPath] = pt.join(targetDir, newName);
    }
    return result;
}

export function renameWhenConflict (name: string, set: Set<string>): string {
    // todo 检测
    while (set.has(name)) {
        const result = name.match(/(\((\d+)\))?(\..*)?$/);

        if (!result) {
            name = `${name}(1)`;
            break;
        }

        const [ replacement, fullCount, count ] = result;

        if (!replacement) {
            name = `${name}(1)`;
        } else {
            let newContent = '';
            if (count) {
                newContent = replacement.replace(fullCount, `(${parseInt(count) + 1})`);
            } else {
                newContent = `(1)${replacement}`;
            }
            name = name.replace(replacement, newContent);
        }
    }
    return name;
}

/**
 * input: /a/b, /a/b/c/d.js
 * output: /a/b/c
 */
export function extractSubDir (target: string, filePath: string) {
    if (target.endsWith('/')) target = target.substring(0, target.length - 1);
    // 构建正则表达式，匹配以 a 路径开头，后面紧跟一个斜杠和一个或多个非斜杠字符
    const regex = new RegExp(`^${target}/([^/]+)`);
    const match = filePath.match(regex);
    return match ? `${target}/${match[1]}` : '';
}
