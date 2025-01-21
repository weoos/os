import { StorageBackEnd, type IDiskBankEnd } from './backend/storage';
import type { IFileStats, IFileType } from './types';
import { clearPath, handlePasteFileNames, splitPathInfo, pt, getParentPath } from './utils';
import { IDBBackEnd } from './backend/idb';
import { SyncMiddleware } from './sync-middleware/sync-middleware';
import { createFileContent, getTypeWithData } from './file-marker';
import { Link, link } from './plugin/link';
import { decode, isU8sEqual, runAS, runASEnd, runPromises } from '@weoos/utils';
import { Zip } from './plugin/zip';
import { Watch } from './plugin/watch';
import type { IPromiseMaybe } from '@weoos/utils/src/types';
import { SyncManager } from './plugin/sync';

interface ICreateOpt {
    ensure?: boolean,
    overwrite?: boolean,
}

type IDisk = Omit<IDiskBankEnd, 'init'|'traverseContent'> & {
    createDir: (path: string, opt?: ICreateOpt) => Promise<boolean>,
    createLink: (path: string, target: string, opt?: ICreateOpt) => Promise<boolean>,
    createFile: (path: string, content: Uint8Array, overwrite?: boolean) => Promise<boolean>,
}

export class Disk implements IDisk {
    current = '/';

    backend: IDiskBankEnd;

    ready: Promise<void>;

    syncMiddleware: SyncMiddleware;

    clipboard: {
        paths: string[],
        isCut: boolean,
        active: boolean,
    } = {
            paths: [],
            isCut: false,
            active: false,
        };

    _link: Link;
    _zip: Zip;
    _watch: Watch;
    _sync: SyncManager;

    static instance: Disk;

    constructor () {
        // ! 单例模式
        if (Disk.instance) return Disk.instance;
        Disk.instance = this;
        this.syncMiddleware = new SyncMiddleware();
        if (StorageBackEnd.Supported()) {
            // console.log('StorageBackEnd');
            this.backend = new StorageBackEnd();
        } else if (IDBBackEnd.Supported()) {
            console.log('IDBBackEnd');
            this.backend = new IDBBackEnd();
        } else {
            throw new Error('No supported storage backend');
        }
        this._link = new Link(this.backend, this.syncMiddleware);
        this._zip = new Zip(this);
        this._watch = new Watch(this);
        this._sync = new SyncManager(this);
        this.ready = this.init();
    }

    private async init () {
        await this.backend.init();
        await this.syncMiddleware.init(this.backend);
    }

    fmtPath (path: string) {
        path = path.trim();
        if (path[0] === '/') return clearPath(path);
        return pt.join(this.current, clearPath(path));
    }

    async size (path: string = '/') {
        return (await this.backend.stat(this.fmtPath(path))).size;
    }
    // 以下为磁盘方法
    cd (path: string) {
        path = this.fmtPath(path);
        if (!this.isDir(path)) return false;
        this.current = path;
        return true;
    }
    pwd () {
        return this.current;
    }
    copy (files: string|string[]) {
        return this._addToClipboard(files);
    }
    copySync (files: string|string[]) {
        this.copy(files);
        return true;
    }
    // async move (source: string, target: string) {
    //     const success = await this.cut([ source ]);
    //     if (!success) return false;
    //     const newFull = this.fmtPath(target);
    //     const oldFull = this.fmtPath(source);
    //     const { parent } = splitPathInfo(newFull);
    //     const renameMap = { [oldFull]: newFull };
    //     return await this.paste(parent, renameMap);
    // }
    // moveSync (source: string, target: string) {
    //     const success = this.cutSync([ source ]);
    //     if (!success) return false;
    //     const newFull = this.fmtPath(target);
    //     const oldFull = this.fmtPath(source);
    //     const { parent } = splitPathInfo(newFull);
    //     const renameMap = { [oldFull]: newFull };
    //     return this.pasteSync(parent, renameMap).success;
    // }

    move (source: string, target: string) {
        return this._move<Promise<boolean>>(source, target);
    }
    moveSync (source: string, target: string) {
        return this._move<boolean>(source, target, true);
    }

    private _move<T> (source: string, target: string, isSync = false) {
        const sync = isSync ? 'Sync' : '';
        return runAS<T>([
            () => this[`cut${sync}`]([ source ]),
            (success, end) => {
                if (!success) return end(false);
                const newFull = this.fmtPath(target);
                const oldFull = this.fmtPath(source);
                const { parent } = splitPathInfo(newFull);
                const renameMap = { [oldFull]: newFull };
                return this[`paste${sync}`](parent, renameMap);
            },
            (info) => info.success,
        ]);
    }


    // _move (result: any[]) {
    //     run(async () => {
    //         const success = await this.cut([ source ]);
    //         if (!success) return false;
    //         const newFull = this.fmtPath(target);
    //         const oldFull = this.fmtPath(source);
    //         const { parent } = splitPathInfo(newFull);
    //         const renameMap = { [oldFull]: newFull };
    //         return await this.paste(parent, renameMap);
    //     });
    // }

    async cut (files: string|string[]) {
        return this._addToClipboard(files, true);
    }
    cutSync (files: string|string[]) {
        this.cut(files);
        return true;
    }
    _addToClipboard (files: string|string[], isCut = false) {
        if (typeof files === 'string') {
            files = [ files ];
        }
        this.clipboard = {
            paths: files.map(path => this.fmtPath(path)),
            active: true,
            isCut,
        };
        return true;
    }
    // async paste (targetDir: string, renameMap?: Record<string, string>) {
    //     const returnResult = (info = '') => {
    //         this.clipboard.active = false;
    //         return { success: !info, info };
    //     };

    //     if (!this.clipboard.active) return returnResult('No Copy Files');

    //     const currentChildren = (await this.ls(targetDir)) || [];

    //     const { isCut, paths } = this.clipboard;
    //     console.log('pasteMap 1', paths, targetDir, currentChildren, renameMap);
    //     const pasteMap = handlePasteFileNames(
    //         paths,
    //         this.fmtPath(targetDir),
    //         currentChildren,
    //         renameMap,
    //     );
    //     console.log('pasteMap', pasteMap);
    //     // 复制所有文件
    //     const fails: string[] = [];
    //     const promises: Promise<void>[] = [];
    //     for (const key in pasteMap) {
    //         promises.push((async () => {
    //             const sourcePath = key;
    //             const targetPath = pasteMap[sourcePath];
    //             if (!await this.copySingle(sourcePath, targetPath)) {
    //                 fails.push(sourcePath);
    //             } else {
    //                 // 如果复制成功且是剪切 则删除源文件
    //                 if (isCut) {
    //                     await this.remove(sourcePath);
    //                 }
    //             }
    //         })());
    //     }
    //     await Promise.all(promises);
    //     if (fails.length > 0) {
    //         return returnResult(`Copy Failed: ${fails.join(', ')}`);
    //     }
    //     return returnResult();
    // }
    // pasteSync (targetDir: string, renameMap?: Record<string, string>) {

    //     const returnResult = (info = '') => {
    //         this.clipboard.active = false;
    //         return { success: !info, info };
    //     };

    //     if (!this.clipboard.active) return returnResult('No Copy Files');

    //     const currentChildren = this.lsSync(targetDir) || [];

    //     const { isCut, paths } = this.clipboard;

    //     console.log('pasteMap 1', paths, targetDir, currentChildren, renameMap);
    //     const pasteMap = handlePasteFileNames(
    //         paths,
    //         this.fmtPath(targetDir),
    //         currentChildren,
    //         renameMap,
    //     );
    //     console.log('pasteMap', pasteMap);
    //     // 复制所有文件
    //     const fails: string[] = [];
    //     for (const key in pasteMap) {
    //         const sourcePath = key;
    //         const targetPath = pasteMap[sourcePath];
    //         if (!this.copySingleSync(sourcePath, targetPath)) {
    //             fails.push(sourcePath);
    //         } else {
    //             // 如果复制成功且是剪切 则删除源文件
    //             if (isCut) {
    //                 this.removeSync(sourcePath);
    //             }
    //         }
    //     }
    //     if (fails.length > 0) {
    //         return returnResult(`Copy Failed: ${fails.join(', ')}`);
    //     }
    //     return returnResult();
    // }

    paste (targetDir: string, renameMap: Record<string, string> = {}) {

        return this._paste<Promise<{
            success: boolean;
            info: string;
        }>>(targetDir, renameMap, {
            ls: (dir: string) => this.ls(dir),
            copy: async (fails, isCut, pasteMap) => {
                const promises: Promise<void>[] = [];
                for (const key in pasteMap) {
                    promises.push((async () => {
                        const sourcePath = key;
                        const targetPath = pasteMap[sourcePath];
                        if (!await this.copySingle(sourcePath, targetPath)) {
                            fails.push(sourcePath);
                        } else {
                            // 如果复制成功且是剪切 则删除源文件
                            if (isCut) {
                                await this.remove(sourcePath);
                            }
                        }
                    })());
                }
                await Promise.all(promises);
                return fails;
            }
        });
    }

    pasteSync (targetDir: string, renameMap: Record<string, string> = {}) {
        return this._paste<{
            success: boolean;
            info: string;
        }>(targetDir, renameMap, {
            ls: (dir: string) => this.lsSync(dir),
            copy: (fails, isCut, pasteMap) => {
                for (const key in pasteMap) {
                    const sourcePath = key;
                    const targetPath = pasteMap[sourcePath];
                    if (!this.copySingleSync(sourcePath, targetPath)) {
                        fails.push(sourcePath);
                    } else {
                        // 如果复制成功且是剪切 则删除源文件
                        if (isCut) {
                            this.removeSync(sourcePath);
                        }
                    }
                }
                return fails;
            }
        });
    }

    private _paste<T> (
        targetDir: string,
        renameMap: Record<string, string>,
        { ls, copy }: {
            ls: (dir: string)=>any,
            copy: (fails: string[], isCut: boolean, pasteMap: any)=>(string[])|Promise<string[]>,
        }
    ) {
        const returnResult = (info = '') => {
            this.clipboard.active = false;
            return runASEnd({ success: !info, info });
        };
        return runAS<T>([
            () => {
                if (!this.clipboard.active) return returnResult('No Copy Files');
                return ls(targetDir);
            },
            (lsResult: string[]) => {
                const currentChildren = lsResult || [];
                const { isCut, paths } = this.clipboard;
                console.log('pasteMap 1', paths, targetDir, currentChildren, renameMap);
                const pasteMap = handlePasteFileNames(
                    paths,
                    this.fmtPath(targetDir),
                    currentChildren,
                    renameMap,
                );
                console.log('pasteMap', pasteMap);
                const fails: string[] = [];
                return { isCut, fails, pasteMap };
            },
            ({ isCut, fails, pasteMap }) => {
                return copy(fails, isCut, pasteMap);
            },
            (fails) => {
                return returnResult(
                    fails.length > 0 ? `Copy Failed: ${fails.join(', ')}` : ''
                );
            }
        ]);
    }

    // _copySingle (path: string, content: Uint8Array) {
    //     return this.backend.write(this.fmtPath(path), content);
    // }

    copySingle (source: string, target: string) {
        return this._copySingle<Promise<boolean>>(source, target, {
            read: (source) => this.read(source),
            copyFile: (target, data) => this.createFile(target, data!, { ensure: true }),
            copyDir: async (target) => {
                let allSuccess = true;
                const promises: (()=>Promise<any>)[] = [
                    () => this.createDir(target)
                ];
                // fs.rename('aa', 'newaa/aa2')
                // NotFoundError: A requested file or directory could not be found at the time an operation was processed.
                await this.backend.traverseContent((path, content) => {
                    promises.push((async () => {
                        const data = await content;
                        const childTarget = path.replace(source, target);
                        if (data) {
                            if (!await this.createFile(childTarget, data)) {
                                allSuccess = false;
                            }
                        } else {
                            if (!await this.createDir(childTarget)) {
                                allSuccess = false;
                            }
                        }
                    }));
                }, source);
                await runPromises(promises);
                return allSuccess;
            }
        });
    }
    copySingleSync (source: string, target: string) {
        return this._copySingle<boolean>(source, target, {
            read: (source) => this.readSync(source),
            copyFile: (target, data) => this.createFileSync(target, data!, { ensure: true }),
            copyDir: (target) => {
                // 异步同步需要分开处理
                const promises: (()=>Promise<any>)[] = [];
                let allSuccess = true;

                const runCreate = (path: string, type: 'file'|'dir', data?: Uint8Array|null) => {
                    const opt = { ensure: true };
                    const { async, sync } =
                type === 'dir' ?
                    this._createDir(path, opt) :
                    this._createFile(path, data || undefined, opt);
                    const success = sync();
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
                runPromises(promises);
                return allSuccess;
            }
        });
    }

    private _copySingle<T> (
        source: string,
        target: string,
        { read, copyFile, copyDir }: {
            read: (source: string)=>IPromiseMaybe<Uint8Array|null>,
            copyFile: (t: string, d: Uint8Array)=>IPromiseMaybe<boolean>,
            copyDir: (t: string)=>IPromiseMaybe<boolean>,
        }
    ) {
        return runAS<T>([
            () => read(source),
            (data: Uint8Array|null, end) => {
                let type: IFileType = 'empty';
                if (data) {
                    type = getTypeWithData(data);
                } else {
                    type = this.isDir(source) ? 'dir' : 'empty';
                }
                if (type === 'empty') return end(false);
                if (type === 'file' || type === 'link') {
                    return end(copyFile(target, data!));
                }
            },
            () => copyDir(target)
        ]);
    }
    /*
    async copySingle (source: string, target: string) {

        const data = await this.read(source);
        let type: IFileType = 'empty';
        if (data) {
            type = getTypeWithData(data);
        } else {
            type = this.isDir(source) ? 'dir' : 'empty';
        }
        if (type === 'empty') return false;
        if (type === 'file' || type === 'link') {
            await this.createFile(target, data!, { ensure: true });
            return true;
        }

        let allSuccess = true;

        const promises: (()=>Promise<any>)[] = [
            () => this.createDir(target)
        ];
        // fs.rename('aa', 'newaa/aa2')
        // NotFoundError: A requested file or directory could not be found at the time an operation was processed.
        await this.backend.traverseContent((path, content) => {
            promises.push((async () => {
                const data = await content;
                const childTarget = path.replace(source, target);
                if (data) {
                    if (!await this.createFile(childTarget, data)) {
                        allSuccess = false;
                    }
                } else {
                    if (!await this.createDir(childTarget)) {
                        allSuccess = false;
                    }
                }
            }));
        }, source);
        await runPromises(promises);
        return allSuccess;
    }
    copySingleSync (source: string, target: string) {

        const data = this.readSync(source);
        let type: IFileType = 'empty';
        if (data) {
            type = getTypeWithData(data);
        } else {
            type = this.isDir(source) ? 'dir' : 'empty';
        }
        if (type === 'empty') return false;
        if (type === 'file' || type === 'link') {
            this.createFileSync(target, data!, { ensure: true });
            return true;
        }

        // 异步同步需要分开处理
        const promises: (()=>Promise<any>)[] = [];
        let allSuccess = true;

        const runCreate = (path: string, type: 'file'|'dir', data?: Uint8Array|null) => {
            const opt = { ensure: true };
            const { async, sync } =
                type === 'dir' ?
                    this._createDir(path, opt) :
                    this._createFile(path, data || undefined, opt);
            const success = sync();
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
        runPromises(promises);
        return allSuccess;
    }
    */
    @link
    async readText (path: string): Promise<string | null> {
        // ! 有link装饰的不需要 format
        const data = await this.backend.read(path);
        if (!data) return '';
        return decode(data);
        // return this.backend.read(this.fmtPath(path));
    }
    @link
    readTextSync (path: string): string | null {
        const data = this.syncMiddleware.read(path);
        if (!data) return '';
        return decode(data);
    }
    // ! 以下为方法迁移
    @link
    async read (path: string): Promise<Uint8Array | null> {
        // ! 有link装饰的不需要 format
        return this.backend.read(path);
        // return this.backend.read(this.fmtPath(path));
    }
    @link
    readSync (path: string): Uint8Array | null {
        return this.syncMiddleware.read(path);
    }
    @link
    async write (path: string, data: Uint8Array): Promise<boolean> {
        return this._write(path, data)?.async || true;
    }
    @link
    writeSync (path: string, data: Uint8Array): boolean {
        return this._write(path, data)?.sync || true;
    }
    private _write (path: string, data: Uint8Array) {
        path = this.fmtPath(path);

        const curData = this.syncMiddleware.pureRead(path);

        if (isU8sEqual(data, curData)) {
            // ! 与本地暂存数据一致 则不写防止写覆盖
            return null;
        }

        if (!this.existSync(path)) {
            const { async, sync } = this._createFile(path, data);
            return { sync: sync(), async: async() };
        }

        const after = this._watch.fireChange(path);
        // data = createFileContent('file', data);
        const result = {
            sync: this.syncMiddleware.write(path, data),
            async: this.backend.write(path, data),
        };
        after?.();
        return result;
    }
    @link
    async append (path: string, data: Uint8Array): Promise<boolean> {
        return this._append(path, data).async;
    }
    @link
    appendSync (path: string, data: Uint8Array): boolean {
        return this._append(path, data).sync;
    }
    private _append (path: string, data: Uint8Array) {
        path = this.fmtPath(path);
        // data = createFileContent('file', data);
        const after = this._watch.fireChange(path);
        const result = {
            sync: this.syncMiddleware.append(path, data),
            async: this.backend.append(path, data),
        };
        after?.();
        return result;
    }
    async remove (path: string): Promise<boolean> {
        return this._remove(path).async;
    }
    removeSync (path: string): boolean {
        return this._remove(path).sync;
    }
    private _remove (path: string) {
        path = this.fmtPath(path);
        return {
            sync: this.syncMiddleware.remove(path, path => {
                this._watch.fireRename(path, true);
            }),
            async: this.backend.remove(path),
        };
    }
    // @link
    async stat (path: string, recursive = true): Promise<IFileStats> {
        return this._transStat(await this.backend.stat(this.fmtPath(path), recursive));
    }
    // @link
    statSync (path: string, recursive = true): IFileStats {
        return this._transStat(this.syncMiddleware.stat(this.fmtPath(path), recursive));
    }
    private _transStat ({ size, type }: Pick<IFileStats, 'type'|'size'>): IFileStats {
        return {
            size,
            type,
            isDirectory: () => type === 'dir',
            isFile: () => type === 'file',
        };
    }
    exist (path: string): Promise<boolean> {
        path = this.fmtPath(path);
        if (path === '/') return Promise.resolve(true);
        return this.backend.exist(path);
    }
    existSync (path: string) {
        path = this.fmtPath(path);
        if (path === '/') return true;
        return this.syncMiddleware.exist(path);
    }
    @link
    async ls (path: string = ''): Promise<string[] | null> {
        path = this.fmtPath(path);
        if (!this.isDir(path)) return null;
        return await this.backend.ls(path);
    }
    @link
    lsSync (path: string = '') {
        path = this.fmtPath(path);
        if (!this.isDir(path)) return null;
        return this.syncMiddleware.ls(path);
    }
    createDir (path: string, opt: ICreateOpt = {}): Promise<boolean> {
        return this._createDir(path, opt).bothAsync();
    }
    createDirSync (path: string, opt: ICreateOpt = {}) {
        return this._createDir(path, opt).bothSync();
    }
    private _createDir (path: string, { overwrite, ensure }: ICreateOpt = {}) {
        path = this.fmtPath(path);

        let fired = false;
        const fire = () => {
            if (fired) return;
            fired = true;
            this._watch.fireRename(path);
        };

        const sync = () => {
            if (ensure) this._ensureParentPathSync(path);
            const r = this.syncMiddleware.createDir(path, overwrite);
            fire();
            return r;
        };
        const async = async () => {
            if (ensure) await this._ensureParentPathAsync(path);
            const r = await this.backend.createDir(path, overwrite);
            fire();
            return r;
        };

        return {
            sync,
            async,
            bothSync: () => {
                const result = sync();
                async();
                return result;
            },
            bothAsync: () => {
                sync();
                return async();
            }
        };
    }
    createFile (path: string, content?: Uint8Array | undefined, opt: ICreateOpt = {}): Promise<boolean> {
        return this._createFile(path, content, opt).async();
    }
    createFileSync (path: string, content?: Uint8Array | undefined, opt: ICreateOpt = {}) {
        return this._createFile(path, content, opt).sync();
    }
    private _createFile (path: string, content?: Uint8Array | undefined, { overwrite, ensure }: ICreateOpt = {}) {
        path = this.fmtPath(path);

        const { parent } = splitPathInfo(path);

        if (!ensure && !this.existSync(parent)) {
            return {
                async: () => Promise.resolve(false),
                sync: () => false,
            };
        }

        let fired = false;
        const fire = () => {
            if (fired) return;
            this._watch.fireRename(path);
            fired = true;
        };

        const sync = () => {
            if (ensure) this._ensureParentPathSync(path);
            // @ts-ignore
            const r = this.syncMiddleware.createFile(path, content, overwrite);
            fire();
            return r;
        };
        const async = async () => {
            if (ensure) await this._ensureParentPathAsync(path);
            const r = await this.backend.createFile(path, content, overwrite);
            fire();
            return r;
        };

        return {
            sync: () => {
                const result = sync();
                async();
                return result;
            },
            async: () => {
                sync();
                return async();
            }
        };
    }

    createLink (path: string, target: string, opt: ICreateOpt = {}) {
        return this._createFile(path, createFileContent('link', target), opt).async();
    }
    createLinkSync (path: string, target: string, opt: ICreateOpt = {}) {
        return this._createFile(path, createFileContent('link', target), opt).sync();
    }
    zip (...args: Parameters<Zip['zip']>) {
        return this._zip.zip(...args);
    }
    unzip (...args: Parameters<Zip['unzip']>) {
        return this._zip.unzip(...args);
    }
    isZip (...args: Parameters<Zip['isZip']>) {
        return this._zip.isZip(...args);
    }
    @link
    watch (...args: Parameters<Watch['watch']>) {
        return this._watch.watch(...args);
    }
    @link
    watchFile (...args: Parameters<Watch['watchFile']>) {
        return this._watch.watchFile(...args);
    }
    @link
    unwatchFile (...args: Parameters<Watch['unwatchFile']>) {
        return this._watch.unwatchFile(...args);
    }

    isDir (path: string) {
        path = this.fmtPath(path);
        // root
        return path === '/' || (this.syncMiddleware.getType(path) === 'dir');
    }

    clear () {
        const result = this.lsSync('/');
        if (!result) return;
        result.forEach(path => {
            this.removeSync(pt.join('/', path));
        });
        this.cd('/');
    }

    ensureParentPathSync (path: string) {
        // ! 此处为了保证同步ensure中，storage中父目录存在
        // ! 只使用同步方法和异步方法单独执行
        this._ensureParentPathAsync(path);
        return this._ensureParentPathSync(path);
    }
    private _ensureParentPathSync (path: string) {
        path = getParentPath(path);
        if (this.existSync(path)) return;
        this._ensureParentPathSync(path);
        this._createDir(path).sync();
    }
    async ensureParentPath (path: string) {
        return this._ensureParentPathAsync(path, true);
    }
    private async _ensureParentPathAsync (path: string, both = false) {
        path = getParentPath(path);
        if (await this.exist(path)) return;
        await this.ensureParentPath(path);
        await this._createDir(path)[both ? 'bothAsync' : 'async']();
    }

    createFileContent (content: string, type: IFileType = 'file') {
        return createFileContent(type, content);
    };

}

export async function initDisk (): Promise<Disk> {
    const disk = new Disk();
    await disk.ready;
    return disk;
}