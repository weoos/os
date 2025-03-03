/*
 * @Author: chenzhongsheng
 * @Date: 2025-02-08 00:38:21
 * @Description: Coding something
 */
import { decode, isU8sEqual, runPromises } from '@weoos/utils';
import type { Disk, IClipboard, ICreateOpt } from '../disk';
import { SyncMiddleware } from '../sync-middleware/sync-middleware';
import { getFileName, getParentPath, handlePasteFileNames, pt } from '../utils';
import { linkSync } from './link';
import type { IFileStats, IFileType } from '../types';
import { createFileContent, getTypeWithData } from '../file-marker';

// 所有的同步执行代码
export class SyncProxy {
    syncMiddleware: SyncMiddleware;
    disk: Disk;
    constructor (disk: Disk) {
        this.syncMiddleware = new SyncMiddleware();
        this.disk = disk;
    }

    async init () {
        await this.syncMiddleware.init(this.backend);
    }

    fmtPath (path: string) {
        return this.disk.fmtPath(path);
    }

    get _link () {
        return this.disk._link;
    }
    get _watch () {
        return this.disk._watch;
    }
    get backend () {
        return this.disk.backend;
    }

    size (path: string = '/') {
        return (this.syncMiddleware.stat(this.fmtPath(path))).size;
    }
    cd (path: string) {
        path = this.fmtPath(path);
        if (!this.isDir(path)) return false;
        this.disk.current = path;
        return true;
    }
    isDir (path: string) {
        path = this.fmtPath(path);
        return path === '/' || (this.getType(path) === 'dir');
    }
    getType (path: string) {
        return this.syncMiddleware.getType(this.fmtPath(path));
    }
    pwd () {
        return this.disk.current;
    }
    copy (files: string|string[]) {
        this.disk.copy(files);
        return true;
    }
    cut (files: string|string[]) {
        this.disk.cut(files);
        return true;
    }
    move (source: string, target: string, onFinalName?: (v: string)=>void) {
        const newFull = this.fmtPath(target);
        const oldFull = this.fmtPath(source);
        const parent = getParentPath(newFull);
        return this.pasteBase(parent, {
            paths: [ oldFull ],
            active: true,
            isCut: true,
        }, { [oldFull]: newFull }, (map) => {
            onFinalName?.(map[oldFull]);
        });
    }
    rename (path: string, name: string, onFinalName?: (v: string)=>void) {
        path = this.fmtPath(path);
        const parent = getParentPath(path);
        const newPath = pt.join(parent, name);
        return this.pasteBase(parent, {
            paths: [ path ],
            active: true,
            isCut: true,
        }, { [path]: newPath }, (map) => {
            onFinalName?.(map[path]);
        });
    }
    paste (
        targetDir: string,
        renameMap: Record<string, string> = {},
        onFinalName?: (map: Record<string, string>) => void,
    ): string {
        const result = this.pasteBase(
            targetDir,
            this.disk.clipboard,
            renameMap,
            onFinalName,
        );
        if (!result && this.disk.clipboard.isCut) {
            this.disk.clipboard = {
                paths: [],
                active: false,
                isCut: false,
            };
        }
        return result;
    }
    pasteBase (
        targetDir: string,
        clipboard: IClipboard,
        renameMap: Record<string, string> = {},
        onFinalName?: (map: Record<string, string>) => void,
    ) {
        if (!clipboard.active) return 'No Copy Files';
        const lsResult = this.ls(targetDir);

        const currentChildren = lsResult || [];
        const { isCut, paths } = clipboard;
        // console.log('pasteMap 1', paths, targetDir, currentChildren, renameMap);
        const pasteMap = handlePasteFileNames(
            paths,
            this.fmtPath(targetDir),
            currentChildren,
            renameMap,
        );
        // {"/aa/a.txt": "/aa/b.txt"}
        // console.log('pasteMap', pasteMap);
        onFinalName?.(pasteMap);
        const fails: string[] = [];
        // copy
        for (const key in pasteMap) {
            const sourcePath = key;
            const targetPath = pasteMap[sourcePath];
            if (!this.copySingle(sourcePath, targetPath)) {
                fails.push(sourcePath);
            } else {
                // 如果复制成功且是剪切 则删除源文件
                if (isCut) {
                    this.remove(sourcePath);
                }
            }
        }
        if (fails.length > 0) {
            return `Copy Failed: ${fails.join(', ')}`;
        }
        return '';
    }
    @linkSync
    ls (path: string = '') {
        path = this.fmtPath(path);
        if (!this.isDir(path)) return null;
        return this.syncMiddleware.ls(path);
    }
    remove (path: string): boolean {
        path = this.fmtPath(path);
        this.backend.remove(path);
        return this.syncMiddleware.remove(path, path => {
            this._watch.fireRename(path, true);
        });
    }
    clear () {
        const result = this.ls('/');
        if (!result || result.length === 0) return;
        result.forEach(path => {
            this.remove(pt.join('/', path));
        });
        this.cd('/');
    }
    copySingle (source: string, target: string) {
        // todo
        const data = this.read(source);

        let type: IFileType = 'empty';
        if (data) {
            type = getTypeWithData(data);
        } else {
            type = this.isDir(source) ? 'dir' : 'empty';
        }
        if (type === 'empty') return false;
        if (type === 'file' || type === 'link') {
            return this.createFile(target, data!, { ensure: true });
        }
        // 异步同步需要分开处理
        const promises: (()=>Promise<any>)[] = [];
        let allSuccess = true;

        const runCreate = (path: string, type: 'file'|'dir', data?: Uint8Array|null) => {
            const opt = { ensure: true };
            let async: () => Promise<boolean> = () => Promise.resolve(true);
            const success = this._create(path, data || undefined, opt, type === 'dir', (v) => {
                async = v;
            });
            this.createFile(path, data || undefined, opt);
            if (!success) {
                allSuccess = false;
                throw new Error(`create fail: ${path}`);
            }
            promises.push(async);
            return success;
        };

        runCreate(target, 'dir');
        this.syncMiddleware.traverseContent((path, content) => {
            const childTarget = path.replace(source, target);
            runCreate(childTarget, !!content ? 'file' : 'dir', content);
        }, source);
        // 异步需要抽出来单独顺序执行
        runPromises(promises);
        return allSuccess;
    }
    traverseContent (
        path: string,
        callback: (path: string, content: Uint8Array | null, name: string) => void,
    ): void {
        return this.syncMiddleware.traverseContent((path, content) => {
            callback(path, content, getFileName(path));
        }, path);
    }
    traverse (path: string, callback: (data: {
        path: string;
        parent: string;
        name: string;
    }) => void) {
        return this.syncMiddleware.traverse(path, callback);
    }
    @linkSync
    read (path: string): Uint8Array | null {
        return this.syncMiddleware.read(path);
    }
    @linkSync
    readText (path: string): string | null {
        const data = this.syncMiddleware.read(path);
        if (!data) return '';
        return decode(data);
    }
    @linkSync
    write (path: string, data: Uint8Array): boolean {
        path = this.fmtPath(path);
        const curData = this.syncMiddleware.pureRead(path);
        if (isU8sEqual(data, curData)) {
            // ! 与本地暂存数据一致 则不写防止写覆盖
            return true;
        }
        if (!this.exist(path)) {
            return this.createFile(path, data);
        }
        const after = this._watch.fireChangeSync(path);
        const success = this.syncMiddleware.write(path, data);
        if (!success) return false;
        this.backend.write(path, data);
        after?.();
        return true;
    }
    @linkSync
    append (path: string, data: Uint8Array): boolean {
        path = this.fmtPath(path);
        if (!this.exist(path)) {
            return this.createFile(path, data);
        }
        const after = this._watch.fireChangeSync(path);
        const success = this.syncMiddleware.append(path, data);
        if (!success) return false;
        this.backend.append(path, data);
        after?.();
        return true;
    }
    exist (path: string) {
        path = this.fmtPath(path);
        if (path === '/') return true;
        return this.syncMiddleware.exist(path);
    }

    // @linkSync
    stat (path: string, recursive = true): IFileStats {
        return this.disk._transStat(this.syncMiddleware.stat(this.fmtPath(path), recursive));
    }
    createFile (path: string, content?: Uint8Array | undefined, opt: ICreateOpt = {}): boolean {
        return this._create(path, content, opt);
    }
    createDir (path: string, opt: ICreateOpt = {}): boolean {
        return this._create(path, undefined, opt, true);
    }
    createLink (path: string, target: string, opt: ICreateOpt = {}) {
        return this.createFile(path, createFileContent('link', target), opt);
    }
    _create (
        path: string,
        content?: Uint8Array | undefined,
        { overwrite, ensure }: ICreateOpt = {},
        isDir: boolean = false,
        onCreateAsync?: (v: ()=>Promise<boolean>)=>void
    ) {
        path = this.fmtPath(path);
        const parent = getParentPath(path);
        if (!ensure && !this.exist(parent)) return false;
        const ready: null|Promise<void> = ensure ? this.ensureParentPath(path) : null;
        const success = (
            isDir ?
                this.syncMiddleware.createDir(path, overwrite) :
                // @ts-ignore
                this.syncMiddleware.createFile(path, content, overwrite)
        );
        if (!success) return false;
        this._watch.fireRename(path);
        const create = async () => {
            if (ensure) await ready;
            // todo 失败了需要撤销
            return isDir ?
                this.backend.createDir(path, overwrite) :
                this.backend.createFile(path, content, overwrite);
        };
        if (onCreateAsync) {
            // 不执行异步，将异步回调出去
            onCreateAsync(create);
        } else {
            create();
        }
        return true;
    }

    ensureParentPath (path: string) {
        // ! 此处为了保证同步ensure中，storage中父目录存在
        // ! 只使用同步方法和异步方法单独执行
        this._ensureParentPath(path);
        return this.disk._ensureParentPath(path);
    }
    _ensureParentPath (path: string) {
        path = getParentPath(path);
        if (this.exist(path)) return;
        this._ensureParentPath(path);
        // 不执行异步逻辑
        this._create(path, undefined, {}, true, () => {});
    }
}