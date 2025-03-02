import type { IPromiseMaybe } from '@weoos/utils';
import { io, isU8sEqual } from '@weoos/utils';
import type { IFileStats, IFileType } from '../types';
import { splitPath } from '../utils';
import { LinkMarkerData, LinkMarkerLen, createFileContent } from '../file-marker';


/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-05 19:44:25
 * @Description: Coding something
 */
export class StorageBackEnd {

    static Supported () {
        return typeof navigator.storage !== 'undefined' && typeof FileSystemWritableFileStream !== 'undefined';
    }
    private root: FileSystemDirectoryHandle;

    async init (): Promise<void> {
        await navigator.permissions.query({ name: 'persistent-storage' });
        const { usage = 0, quota = 0 } = await navigator.storage.estimate();
        if (usage >= quota) {
            throw new Error('存储空间不足');
        }
        // console.log(`已使用空间: ${usage} 字节`);
        // console.log(`可用空间配额: ${quota} 字节`);
        this.root = await navigator.storage.getDirectory();
        // @ts-ignore
        // window.root = this.root;
    }

    // 读取文件内容，path为绝对路径
    async read (path: string): Promise<Uint8Array|null> {
        const { file } = await this.getHandleByPath(path);
        if (!file) { return null; }
        return this._readFile(file);
    }

    // 写入内容到文件，path为绝对路径
    async write (path: string, data: Uint8Array): Promise<boolean> {
        const { file } = await this.getHandleByPath(path);
        if (!file) { return false; }
        await this._writeFile(file, data);
        return true;
    }

    private async _writeFile (file: FileSystemFileHandle, data: Uint8Array) {
        const writer = await file.createWritable();
        await writer.write(data);
        await writer.close();
    }

    // 追加内容到文件，path为绝对路径
    async append (path: string, data: Uint8Array): Promise<boolean> {
        const { file } = await this.getHandleByPath(path);
        if (!file) { return false; }
        const writer = await file.createWritable();
        const content = await this._readFile(file);
        await writer.write(content);
        await writer.write({ type: 'write', position: content.byteLength, data });
        await writer.close();
        return true;
    }

    // 移除文件，path为绝对路径
    async remove (path: string): Promise<boolean> {
        const { name, dir } = await this.getParentByPath(path);
        if (!dir) { return false; }
        const [ , err ] = await io(dir.removeEntry(name, { recursive: true }));
        return !err;
    }

    async stat (path: string, recursive = true): Promise<Pick<IFileStats, 'size'|'type'>> {
        const { type, file, dir } = await this.getHandleByPath(path);

        if (type === 'empty') return { size: 0, type };
        let size = 0;

        if (type === 'file') {
            const _file = await file!.getFile();
            size = _file.size;
            if (await this._isLinkFile(_file)) {
                return { type: 'link', size };
            }
        } else {
            if (recursive) {
                const promises: Promise<void>[] = [];
                await this.traverse(dir!, (file) => {
                    promises.push((async () => {
                        size += (await file.getFile()).size;
                    })());
                });
                await Promise.all(promises);
            }
        }
        return { type, size };
    }

    private async _isLinkFile (_file: File) {
        const size = _file.size;
        if (size === LinkMarkerLen) {
            const data = new Uint8Array(await _file.arrayBuffer());
            if (isU8sEqual(data, LinkMarkerData)) {
                return true;
            }
        }
        return false;
    }

    private async traverse (
        dir: FileSystemDirectoryHandle,
        callback: (item: FileSystemFileHandle, name: string) => void,
    ) {
        for await (const item of dir.entries()) {
            if (item[1].kind === 'directory') {
                await this.traverse(item[1], callback);
            } else {
                callback(item[1], item[0]);
            }
        }
    }

    // content = null 表示为 目录
    async traverseContent (
        callback: (path: string, content: Promise<Uint8Array|null>, name: string) => IPromiseMaybe<void>,
        path = '',
        read = true,
    ) {
        let dir: FileSystemDirectoryHandle;
        if (!path) {
            dir = this.root;
        } else {
            const { dir: _dir } = await this.getHandleByPath(path);
            if (!_dir) {
                throw new Error(`dir not found: ${path}`);
            }
            dir = _dir;
        }
        await this._traverseContent(path, dir, callback, read);
    }

    private async _traverseContent (
        path: string,
        dir: FileSystemDirectoryHandle,
        callback: (path: string, content: Promise<Uint8Array|null>, name: string) => IPromiseMaybe<void>,
        read: boolean,
    ) {
        for await (const item of dir.entries()) {
            const [ name, dir ] = item;
            const fullPath = `${path}/${name}`;
            if (dir.kind === 'directory') {
                await callback(fullPath, Promise.resolve(null), name);
                await this._traverseContent(fullPath, dir, callback, read);
            } else {
                await callback(fullPath, read ? this._readFile(dir) : Promise.resolve(null), name);
            }
        }
    }

    // 检查文件是否存在，path为绝对路径
    async exist (path: string): Promise<boolean> {
        const { type } = await this.getHandleByPath(path);
        return type !== 'empty';
    }

    // 查看目录下的文件列表，path为绝对路径
    async ls (path: string): Promise<string[]|null> {
        // __DEV__ && console.log(`ls ${path}`);
        const { type, dir } = await this.getHandleByPath(path);
        if (type !== 'dir') {
            return null;
        }
        const list: string[] = [];
        for await (const item of dir!.keys()) {
            list.push(item);
        }
        return list;
    }

    private async existInDir (name: string, dir: FileSystemDirectoryHandle) {
        for await (const item of dir.keys()) {
            if (name === item) return true;
        }
        return false;
    }

    async createLink (
        path: string,
        target: string,
        overwrite = false
    ) {
        return this.createFile(
            path,
            createFileContent('link', target),
            overwrite
        );
    }

    async createFile (
        path: string,
        content?: Uint8Array,
        overwrite: boolean = false,
    ): Promise<boolean> {
        const { dir, name } = await this.clearTarget(path, overwrite);

        if (!dir) return false;

        const f = await dir.getFileHandle(name, { create: true });
        if (content) {
            await this._writeFile(f, content);
        }
        return true;
    }

    async createDir (path: string, overwrite = false) {
        const { dir, name } = await this.clearTarget(path, overwrite);
        if (!dir) return false;
        await dir.getDirectoryHandle(name, { create: true });
        return true;
    }

    private async clearTarget (path: string, overwrite: boolean) {
        const { name, dir } = await this.getParentByPath(path);
        if (!dir) return { dir: null, name };
        if (await this.existInDir(name, dir)) {
            if (overwrite) {
                await dir.removeEntry(name, { recursive: true });
            } else {
                return { dir: null, name };
            }
        }
        return { dir, name };
    }

    private async _readFile (file: FileSystemFileHandle) {
        const f = await file.getFile();
        return new Uint8Array(await f.arrayBuffer());
    }
    private async getHandleByPath (path: string): Promise<{
        type: IFileType,
        file?: FileSystemFileHandle,
        dir?: FileSystemDirectoryHandle,
    }> {

        if (path === '/') return { type: 'dir', dir: this.root };

        const { name, dir } = await this.getParentByPath(path);

        if (!dir) return { type: 'empty' };

        const [ file, err ] = await io(dir.getFileHandle(name));

        if (err) {
            const [ _dir, err ] = await io(dir.getDirectoryHandle(name));
            if (err) return { type: 'empty' };
            return { type: 'dir', dir: _dir };
        } else {

            return { type: 'file', file };
        }
    }

    private async getParentByPath (path: string): Promise<{
        name: string,
        dir?: FileSystemDirectoryHandle,
    }> {
        const [ paths, tail ] = splitPath(path);
        if (!tail) return { name: tail };
        let current: FileSystemDirectoryHandle = this.root;
        for (const path of paths) {
            const [ dir, err ] = await io(current.getDirectoryHandle(path));
            if (err) return { name: path };
            current = dir;
        }
        return { name: tail, dir: current };
    }

    async getType (path: string) {
        const { type } = await this.getHandleByPath(path);
        return type;
    }

}

export type IDiskBankEnd = Pick<
    InstanceType<typeof StorageBackEnd>,
    'init'|'read'|'write'|'append'|'remove'|
    'stat'|'exist'|'ls'|'createDir'|'createFile'|
    'traverseContent'|'getType'
>;
