import { StorageBackEnd, type IDiskBankEnd } from './backend/storage';
import type { IFileStats, IFileType } from './types';
import { clearPath, handlePasteFileNames, splitPathInfo, pt, getParentPath } from './utils';
import { IDBBackEnd } from './backend/idb';
import { createFileContent, getTypeWithData } from './file-marker';
import { Link, link } from './plugin/link';
import { decode, isU8sEqual, runPromises } from '@weoos/utils';
import { Zip } from './plugin/zip';
import { Watch } from './plugin/watch';
import { SyncProxy } from './plugin/sync';
import { UpdateManager } from './plugin/update';

export interface ICreateOpt {
    ensure?: boolean,
    overwrite?: boolean,
}

type IDisk = Omit<IDiskBankEnd, 'init'|'traverseContent'> & {
    createDir: (path: string, opt?: ICreateOpt) => Promise<boolean>,
    createLink: (path: string, target: string, opt?: ICreateOpt) => Promise<boolean>,
    createFile: (path: string, content: Uint8Array, overwrite?: boolean) => Promise<boolean>,
}

export interface IDiskOption{
    enableSync?: boolean
}

export class Disk implements IDisk {
    current = '/';

    backend: IDiskBankEnd;

    ready: Promise<void>;

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
    _sync: SyncProxy;
    get sync () {
        return this._sync;
    }
    _update: UpdateManager;

    static instance: Disk;

    enableSync: boolean;

    constructor ({
        enableSync = false,
    }: IDiskOption = {}) {
        // ! 单例模式
        if (Disk.instance) {
            // ! 第二次启动如果带了enableSync并且之前没有 则初始化sync模块
            Disk.instance._initSyncAlone(enableSync);
            return Disk.instance;
        }
        Disk.instance = this;
        this.enableSync = enableSync;
        if (StorageBackEnd.Supported()) {
            // console.log('StorageBackEnd');
            this.backend = new StorageBackEnd();
        } else if (IDBBackEnd.Supported()) {
            // console.log('IDBBackEnd');
            this.backend = new IDBBackEnd();
        } else {
            throw new Error('No supported storage backend');
        }
        if (this.enableSync) {
            this._sync = new SyncProxy(this);
        }
        this._link = new Link(this.backend, this._sync?.syncMiddleware);
        this._zip = new Zip(this);
        this._watch = new Watch(this);
        this._update = new UpdateManager(this);
        this._update.init();
        this.ready = this.init();
    }

    initSync () {
        return this._initSyncAlone(true);
    }

    static initSync () {
        if (!Disk.instance) {
            const disk = new Disk({ enableSync: true });
            return disk.ready;
        }
        return Disk.instance.initSync();
    }

    async _initSyncAlone (enableSync: boolean) {
        if (enableSync && !this.enableSync) {
            this.enableSync = enableSync;
            this._sync = new SyncProxy(this);
            this.ready = this._sync.init();
            await this.ready;
        }
    }

    private async init () {
        await this.backend.init();
        await this._sync?.init();
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
    async cd (path: string) {
        path = this.fmtPath(path);
        if (!await this.isDir(path)) return false;
        this.current = path;
        return true;
    }
    async isDir (path: string) {
        path = this.fmtPath(path);
        return path === '/' || (await this.getType(path) === 'dir');
    }

    async getType (path: string) {
        path = this.fmtPath(path);
        return this.backend.getType(path);
    }
    pwd () {
        return this.current;
    }
    async copy (files: string|string[]) {
        return this._addToClipboard(files);
    }
    async move (source: string, target: string) {
        const success = await this.cut([ source ]);
        if (!success) return false;
        const newFull = this.fmtPath(target);
        const oldFull = this.fmtPath(source);
        const { parent } = splitPathInfo(newFull);
        const renameMap = { [oldFull]: newFull };
        return this.paste(parent, renameMap);
    }
    async cut (files: string|string[]) {
        return this._addToClipboard(files, true);
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

    async paste (targetDir: string, renameMap: Record<string, string> = {}): Promise<string> {
        if (!this.clipboard.active) return 'No Copy Files';
        const lsResult = await this.ls(targetDir);

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
        // copy
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
        if (fails.length > 0) {
            return `Copy Failed: ${fails.join(', ')}`;
        }
        return '';
    }

    async copySingle (source: string, target: string) {
        const data = await this.read(source);
        let type: IFileType = 'empty';
        if (data) {
            type = getTypeWithData(data);
        } else {
            type = await this.isDir(source) ? 'dir' : 'empty';
        }
        if (type === 'empty') return false;
        if (type === 'file' || type === 'link') {
            return await this.createFile(target, data!, { ensure: true });
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
    @link
    async readText (path: string): Promise<string | null> {
        // ! 有link装饰的不需要 format
        const data = await this.backend.read(path);
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
    async write (path: string, data: Uint8Array): Promise<boolean> {
        path = this.fmtPath(path);

        const curData = this.enableSync ?
            this._sync.syncMiddleware.pureRead(path) :
            await this.backend.read(path);

        if (isU8sEqual(data, curData)) {
            // ! 与本地暂存数据一致 则不写防止写覆盖
            return true;
        }
        if (!await this.exist(path)) {
            return this.createFile(path, data);
        }
        const after = await this._watch.fireChange(path);
        const success = await this.backend.write(path, data);
        if (!success) return false;
        this._sync?.syncMiddleware.write(path, data);
        after?.();
        return true;
    }
    @link
    async append (path: string, data: Uint8Array): Promise<boolean> {
        path = this.fmtPath(path);
        if (!await this.exist(path)) {
            return this.createFile(path, data);
        }
        const after = await this._watch.fireChange(path);
        const success = await this.backend.append(path, data);
        if (!success) return false;
        this._sync?.syncMiddleware.append(path, data);
        after?.();
        return true;
    }
    async remove (path: string): Promise<boolean> {
        path = this.fmtPath(path);
        const succcess = await this.backend.remove(path);
        if (!succcess) return succcess;
        if (this.enableSync) {
            this._sync.syncMiddleware.remove(path, path => {
                this._watch.fireRename(path, true);
            });
        } else {
            this._watch.fireRename(path, true);
        }
        return true;
    }
    // @link
    async stat (path: string, recursive = true): Promise<IFileStats> {
        return this._transStat(await this.backend.stat(this.fmtPath(path), recursive));
    }
    _transStat ({ size, type }: Pick<IFileStats, 'type'|'size'>): IFileStats {
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
    @link
    async ls (path: string = ''): Promise<string[] | null> {
        path = this.fmtPath(path);
        if (!this.isDir(path)) return null;
        return await this.backend.ls(path);
    }
    async createFile (path: string, content?: Uint8Array | undefined, opt: ICreateOpt = {}) {
        return this._create(path, content, opt, false);
    }
    async createDir (path: string, opt: ICreateOpt = {}): Promise<boolean> {
        return this._create(path, undefined, opt, true);
    }
    async _create (
        path: string,
        content?: Uint8Array | undefined,
        { overwrite, ensure }: ICreateOpt = {},
        isDir: boolean = false,
    ) {
        path = this.fmtPath(path);
        const parent = getParentPath(path);
        if (!ensure && !await this.exist(parent)) return false;
        if (ensure) await this.ensureParentPath(path);
        const success = await (
            isDir ?
                this.backend.createDir(path, overwrite) :
                this.backend.createFile(path, content, overwrite)
        );
        if (!success) return false;
        this._watch.fireRename(path);
        isDir ?
            this._sync.syncMiddleware.createDir(path, overwrite) :
            // @ts-ignore
            this._sync.syncMiddleware.createFile(path, content, overwrite);
        return success;
    }

    createLink (path: string, target: string, opt: ICreateOpt = {}) {
        return this.createFile(path, createFileContent('link', target), opt);
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

    async clear () {
        const result = await this.ls('/');
        if (!result || result.length === 0) return;
        await Promise.all(result.map(path => {
            return this.remove(pt.join('/', path));
        }));
        await this.cd('/');
    }

    async ensureParentPath (path: string) {
        // ! 此处为了保证同步ensure中，storage中父目录存在
        // ! 只使用同步方法和异步方法单独执行
        this._sync?._ensureParentPath(path);
        return this._ensureParentPath(path);
    }
    async _ensureParentPath (path: string) {
        path = getParentPath(path);
        if (await this.exist(path)) return;
        await this.ensureParentPath(path);
        await this._create(path, undefined, {}, true);
    }

    createFileContent (content: string, type: IFileType = 'file') {
        return createFileContent(type, content);
    };

}

export async function initDisk (opt?: IDiskOption): Promise<Disk> {
    const disk = new Disk(opt);
    await disk.ready;
    return disk;
}