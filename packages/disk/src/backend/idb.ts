/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-06 15:49:53
 * @Description: Coding something
 */

import { io, mergeU8s } from '@weoos/utils';
import type { IFileStats } from '../types';
import type { IDiskBankEnd } from './storage';
import localforage from 'localforage';
import { clearPath, splitPathInfo } from '../utils';
import { getTypeWithData, createFileContent } from '../file-marker';

export class IDBBackEnd implements IDiskBankEnd {
    async traverseContent (
        callback: (name: string, content: Promise<Uint8Array|null>) => void,
        path = '',
    ) {
        const keys = await localforage.keys();
        for (const key of keys) {
            if (key.startsWith(path)) {
                callback(key, localforage.getItem(key) as Promise<Uint8Array>);
            }
        }
    }
    static Supported () {
        // localforage 使用 localStorage兜底理论上不会不支持
        return true;
    }
    async init (): Promise<void> {
        await localforage.ready();
    }
    async read (path: string): Promise<Uint8Array | null> {
        const content = await localforage.getItem<Uint8Array>(clearPath(path));
        const type = getTypeWithData(content);
        if (type === 'empty' || type === 'dir') return null;
        return content;
    }
    async write (path: string, data: Uint8Array): Promise<boolean> {
        const [ , err ] = await io(localforage.setItem(clearPath(path), data));
        return !err;
    }
    async append (path: string, data: Uint8Array): Promise<boolean> {
        path = clearPath(path);
        const prev = await this.read(path);
        if (!prev) return false;
        return this.write(path, mergeU8s(prev, data));
    }
    async remove (path: string): Promise<boolean> {
        path = clearPath(path);
        const data = await this.read(clearPath(path));
        const type = getTypeWithData(data);

        if (type === 'empty') return false;

        const [ , err ] = await io(localforage.removeItem(path));
        if (!err) return !err;

        if (type === 'file') return true;

        const promises: Promise<any>[] = [];
        // 需要删除所有的子目录
        await this.traverse(path, ({ path }) => {
            promises.push(localforage.removeItem(path));
        });
        await Promise.all(promises);
        return true;
    }
    async stat (path: string, recursive?: boolean): Promise<Pick<IFileStats, 'size'|'type'>> {
        path = clearPath(path);
        const data = await this.read(path);
        const type = getTypeWithData(data);

        if (type === 'empty') return { size: 0, type };
        if (type === 'file' || type === 'link') return { size: data!.byteLength, type };

        if (!recursive) return { size: 0, type };

        let size = 0;
        const promises: Promise<any>[] = [];
        await this.traverse(path, ({ path }) => {
            promises.push((async () => {
                size += (await this.stat(path, recursive)).size;
            })());
        });
        await Promise.all(promises);
        return { size, type };
    }

    async exist (path: string): Promise<boolean> {
        return !!(await this.read(clearPath(path)));
    }
    async ls (path: string): Promise<string[]> {

        const result: string[] = [];
        await this.traverse(path, ({ parent, name }) => {
            if (parent === path) result.push(name);
        });
        return result;
    }

    async createFile (
        path: string,
        content = new Uint8Array([]),
        overwrite = false
    ): Promise<boolean> {
        if (!overwrite) {
            if (await this.exist(path)) return false;
        }
        await this.write(path, content);
        return true;
    }
    async createDir (path: string, overwrite?: boolean): Promise<boolean> {
        path = clearPath(path);

        if (await this.exist(path)) {
            if (!overwrite) return false;

            // 需要覆盖且存在情况下 先删除
            const promises: Promise<any>[] = [];
            await this.traverse(path, ({ path }) => {
                promises.push(this.remove(path));
            });
            await Promise.all(promises);
        }
        await this.write(path, createFileContent('dir'));
        return true;
    }
    private async traverse (
        path: string,
        callback: (data: {path: string, parent: string, name: string})=>void,
    ): Promise<void> {
        const keys = await localforage.keys();
        const parentPath = clearPath(path, true);
        for (const key of keys) {
            if (key.startsWith(parentPath)) {
                callback(splitPathInfo(key));
            }
        }
    }
}