/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-06 17:38:24
 * @Description: Coding something
 *
 * 为了实现Sync实现的中间层
 */

import { mergeU8s } from '@weoos/utils';
import type { IDiskBankEnd } from '../backend/storage';
import { createFileContent, getTypeWithData } from '../file-marker';
import { clearPath, splitPathInfo } from '../utils';
import type { IFileType } from '../types';
import { createDirContent } from '../file-marker';


export class SyncMiddleware {
    /**
     * 内存中存在的存储所有文件的map，用于同步方法的实现
     * 初始化时需要遍历存储的所有文件，将其加载到内存中
     * 读写时需要同步
     */
    // ! 此数据结构会非常大
    private fileMap: Record<string, Uint8Array> = {};

    async init (backend: IDiskBankEnd) {
        const promises: Promise<void>[] = [];
        // console.log('sync middleware traverse');
        await backend.traverseContent((name, content) => {
            // console.log(`sync middleware traverse: name=${name}`);
            promises.push((async () => {
                const data = await content;
                this.fileMap[name] = data || createDirContent().data;
            })());
        });
        await Promise.all(promises);
    }

    read (key: string) {
        const data = this.fileMap[key];
        const type = getTypeWithData(data);
        if (type === 'empty' || type === 'dir') return null;
        return data;
    }
    pureRead (key: string) {
        return this.fileMap[key];
    }
    write (key: string, content: Uint8Array) {
        this.fileMap[key] = content;
        return true;
    }
    append (key: string, content: Uint8Array) {
        if (key in this.fileMap) return false;

        const data = this.read(key);

        if (!data) {
            throw new Error('file not found');
        }

        return this.write(
            key,
            mergeU8s(data, content)
        );
    }

    remove (path: string, onRemove?: (path: string)=>void): boolean {
        const type = this.getType(path);

        if (type === 'empty') return false;

        if (!(path in this.fileMap)) {
            return false;
        }

        this._removeSingle(path, onRemove);

        if (type === 'file') return true;

        // 需要删除所有的子目录
        this.traverse(path, ({ path }) => {
            this._removeSingle(path, onRemove);
        });
        return true;
    }

    private _removeSingle (path: string, onRemove?: (path: string)=>void) {
        delete this.fileMap[path];
        onRemove?.(path);
    }

    stat (path: string, recursive?: boolean): {
        size: number;
        type: IFileType;
    } {
        const data = this.fileMap[path];
        const type = getTypeWithData(data);

        if (type === 'empty') return { size: 0, type };
        if (type === 'file' || type === 'link') return { size: data!.byteLength, type };

        if (!recursive) return { size: 0, type };

        let size = 0;
        this.traverse(path, ({ path }) => {
            const data = this.fileMap[path];
            const type = getTypeWithData(data);
            if (type === 'file') size += data!.byteLength;
        });
        return { size, type };
    }

    exist (path: string) {
        return path in this.fileMap;
    }
    ls (path: string): string[] {
        const result: string[] = [];
        this.traverse(path, ({ parent, name }) => {
            if (parent === path) result.push(name);
        });
        return result;
    }
    createFile (
        path: string,
        content = new Uint8Array([]),
        overwrite = false
    ): boolean {
        if (!overwrite) {
            if (this.exist(path)) return false;
        }
        this.write(path, content);
        return true;
    }
    createDir (path: string, overwrite?: boolean): boolean {

        if (this.exist(path)) {
            if (!overwrite) return false;

            // 需要覆盖且存在情况下 先删除
            this.traverse(path, ({ path }) => {
                this.remove(path);
            });
        }
        this.write(path, createFileContent('dir'));
        return true;
    }

    getType (path: string): IFileType {
        const data = this.fileMap[path];
        return getTypeWithData(data);
    }

    traverse (
        path: string,
        callback: (data: {path: string, parent: string, name: string})=>void,
        includeSelf = false,
    ) {
        const keys = Object.keys(this.fileMap);
        // ! 如果包含自身, 则不需要携带末尾的 /
        const parentPath = clearPath(path, !includeSelf);
        for (const key of keys) {
            if (key.startsWith(parentPath)) {
                callback(splitPathInfo(key));
            }
        }
    }

    traverseContent (callback: (path: string, content: Uint8Array|null)=>void, path = '') {
        this.traverse(path, ({ path }) => {
            callback(path, this.read(path));
        });
    }
}