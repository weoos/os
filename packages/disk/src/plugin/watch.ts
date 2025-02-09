/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-12 23:13:58
 * @Description: Coding something
 */
import type { IFileStats } from '../types';
import type { Disk } from '../disk';
import { EventEmitter } from 'events';
import { ChangType } from '../enum';
import { Buffer } from 'buffer';

export type IWatchEncoding = BufferEncoding | 'buffer';

export interface IWatchOptions {
    persistent?: boolean,
    recursive?: boolean,
    encoding?: IWatchEncoding,
}

export type IWatchCallback = (event:'rename'|'change', path: string|Buffer) => void;


export class FSWatcher extends EventEmitter<{
    change: ['rename'|'change', string|Buffer],
    error: [Error],
}> {
    watch: Watch;
    options: Required<IWatchOptions>;
    callback: IWatchCallback;
    path: string;
    constructor ({
        watch, options, callback, path,
    }: {
        watch: Watch,
        options: IWatchOptions,
        callback: IWatchCallback
        path: string,
        enabled?: boolean,
    }) {
        super();
        if (watch) {
            this.options = Object.assign({
                persistent: true,
                recursive: false,
                encoding: 'utf8',
            }, options);
            this.watch = watch;
            this.callback = callback;
            this.path = path;
        }
    }

    static empty () {
        return new FSWatcher({} as any);
    }

    close () {
        const index = this.watch.watchers.indexOf(this);
        if (index > -1) this.watch.watchers.splice(index, 1);
        this.removeAllListeners();
    }

    checkChange (path: string, type: 'rename'|'change') {
        const { recursive, encoding } = this.options;
        const passed = recursive ? (path.startsWith(this.path)) : (path === this.path);
        if (!passed) return;
        const name = path.replace(this.path, '');
        const filename = encoding === 'buffer' ? Buffer.from(name) : Buffer.from(name, encoding).toString();
        this.emit('change', type, filename);
        this.callback(type, filename);
    }
}

export type IFileListener = (curr: IFileStats, prev: IFileStats)=>void;

export interface IFileWatchOptions {
    bigint?: boolean;
    persistent?: boolean;
    interval?: number;
}

export class Watch {

    events = new EventEmitter();

    watchers: FSWatcher[] = [];

    fileWatchers: Record<string, IFileListener[]> = {};

    constructor (public disk: Disk) {
    }

    // 绝对路径
    fireRename (path: string, isRemove = false, emit = true) {
        if (emit) {
            // ! 防止重复被sync模块watch
            this.events.emit('watch', {
                type: isRemove ? ChangType.Remove : ChangType.Create,
                path,
            });
        }
        // 重命名文件会触发两次 rename
        // 移动也会触发两次 rename，移动到其他目录触发1次 rename
        // 删除只会触发一次
        // 新建触发一次
        this.watchers.forEach(watcher => {
            watcher.checkChange(path, 'rename');
        });
    }
    // 绝对路径
    async fireChange (path: string, emit = true) {
        if (emit) {
            this.events.emit('watch', {
                type: ChangType.Change,
                path,
            });
        }
        const list = this.fileWatchers[path];
        let after: (()=>void)|null = null;
        if (list && list.length > 0) {
            const prev = await this.disk.stat(path);
            after = () => {
                list.forEach(async listener => listener(await this.disk.stat(path), prev));
            };
        }
        this.watchers.forEach(watcher => {
            watcher.checkChange(path, 'change');
        });
        return after;
    }
    // 绝对路径
    fireChangeSync (path: string, emit = true) {
        if (emit) {
            this.events.emit('watch', {
                type: ChangType.Change,
                path,
            });
        }
        const list = this.fileWatchers[path];
        let after: (()=>void)|null = null;
        if (list && list.length > 0) {
            const prev = this.disk._sync.stat(path);
            after = () => {
                list.forEach(listener => listener(this.disk._sync.stat(path), prev));
            };
        }
        this.watchers.forEach(watcher => {
            watcher.checkChange(path, 'change');
        });
        return after;
    }

    watch (
        path: string,
        options: IWatchOptions|IWatchEncoding|IWatchCallback,
        callback?: IWatchCallback
    ) {
        path = this.disk.fmtPath(path);
        if (typeof options === 'function') {
            callback = options;
            options = {};
        } else if (typeof options === 'string') {
            options = { encoding: options };
        }
        if (
            options.persistent === false &&
            this.watchers.find(item => item.path === path)
        ) {
            return FSWatcher.empty();
        }
        const watcher = new FSWatcher({
            watch: this,
            options: options as IWatchOptions,
            callback: callback as IWatchCallback,
            path,
        });
        this.watchers.push(watcher);
        return watcher;
    }
    watchFile (
        path: string,
        options: IFileWatchOptions|IFileListener,
        callback?: IFileListener
    ) {
        path = this.disk.fmtPath(path);
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }

        // ! 其他两个参数无效
        const { persistent = true } = options;

        if (persistent && this.fileWatchers[path]) return;

        if (!this.fileWatchers[path]) {
            this.fileWatchers[path] = [];
        }
        this.fileWatchers[path].push(callback!);
    }

    unwatchFile (
        path: string,
        callback?: IFileListener
    ) {
        path = this.disk.fmtPath(path);
        const ls = this.fileWatchers[path];
        if (!ls) return;

        if (!callback) {
            delete this.fileWatchers[path];
        } else {
            const index = ls.indexOf(callback);
            if (index > -1) ls.splice(index, 1);
            if (ls.length === 0) delete this.fileWatchers[path];
        }
    }

}