/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-20 19:17:36
 * @Description: Coding something
 */
/*
用于跨页面 跨worker的数据同步
机制：使用 localforage 存储变更信息
每个系统里定时读取变更信息，如有变更则同步更新 syncMiddleware

数据结构

webos_fs_update_info: [{
    id: string,
    time: timestamp,
    changes: {
        path: 'create'|'remove'|'change',
    }
}]

1. 每次启动检查, 过期的都移除（大于INTERVAL*2认为过期）
2. 每次变更先写入缓存，定时一起写入
3. 定时检查变更，用于同步更新
4. 写入
*/

import localforage from 'localforage';
import type { Disk } from '../disk';
import { ChangType } from '../enum';
import { isU8sEqual } from '@weoos/utils';

const CHECK_INTERVAL = 500;

export interface ChangeInfo {
    id: string,
    time: number,
    changes: Record<string, ChangType>,
}

const Storage = (() => {
    const KEY = 'webos_fs_update_info';

    const store = localforage.createInstance({
        name: 'sync-manager',
        driver: localforage.INDEXEDDB,
    });

    const id = Math.random().toString(16).substring(2);

    const _write = (data) => {
        return store.setItem(KEY, data);
    };

    // window._testSync = () => {
    //     localforage.getItem(KEY).then((d) => {
    //         console.log('KEY', d);
    //     });
    // };

    return {
        id,
        async writeData (data: ChangeInfo[]) {
            await _write(data);
        },
        async writeChanges (changes: Record<string, ChangType>) {
            const data = await this.read();
            const item: ChangeInfo = {
                time: Date.now(),
                id,
                changes,
            };
            if (data.length === 0) {
                data.push(item);
            } else {
                // ! 按时间顺序插入
                const index = data.findIndex(v => v.time > item.time);
                if (index === -1) {
                    data.push(item);
                } else {
                    data.splice(index, 0, item);
                }
            }
            await _write(data);
        },
        async read () {
            const data = await store.getItem<ChangeInfo[]>(KEY);
            if (!Array.isArray(data)) return [];
            return data;
        }
    };
})();

export class UpdateManager {


    tempChange: Record<string, ChangType> = {};

    timer: any;

    lastOprateId: string = '';

    disk: Disk;
    private offWatch: ()=>void;

    constructor (disk: Disk) {
        this.disk = disk;
    }
    init () {
        this.timer = setInterval(async () => {
            await this.checkUpdate();
            await this.checkWriteChange();
        }, CHECK_INTERVAL);
        const fn = ({ path, type }: {type: ChangType, path: string}) => {
            this.tempChange[path] = type;
        };
        this.disk._watch.events.on('watch', fn);
        this.offWatch = () => {
            this.disk._watch.events.off('watch', fn);
        };
    }

    get sync () {
        return this.disk._sync?.syncMiddleware;
    }

    // 检查更新的文件
    async checkUpdate () {
        const data = await Storage.read();
        if (data.length === 0) return;

        const removeIndexes: number[] = [];
        const now = Date.now();
        const isOutDate = (time: number) => (now - time) > CHECK_INTERVAL * 2;

        const changes: Record<string, ChangType> = {};
        for (let i = 0; i < data.length; i++) {
            const item = data[i];

            if (isOutDate(item.time)) {
                removeIndexes.push(i);
                continue;
            }
            if (item.id === Storage.id) continue; // 忽略自身变更
            // 按时间覆盖
            Object.assign(changes, item.changes);
        }

        // ! 清理过期记录
        if (removeIndexes.length) {
            for (let i = removeIndexes.length - 1; i >= 0; i--) {
                data.splice(removeIndexes[i], 1);
            }
            await Storage.writeData(data);
        }

        // 此处异步即可
        this.useChanges(changes);
    }

    // 同步syncMiddleware的内容
    private async writeFile (path: string) {
        if (!this.disk.enableSync) return true;
        const data = await this.disk.read(path);

        if (data) {
            const curData = this.sync.pureRead(path);
            if (isU8sEqual(data, curData)) {
                return false;
            }
            this.sync.write(path, data);
            return true;
        }
        return false;
    }

    private async useChanges (changes: Record<string, ChangType>) {
        // console.log('useChanges', changes);
        if (Object.keys(changes).length === 0) return;

        // 按路径长度排序，先对短路径操作；这样可以避免上级目录被删除的情况
        const keys = Object.keys(changes).sort((a, b) => {
            return a.length - b.length;
        });

        for (const path of keys) {
            const type = changes[path];
            switch (type) {
                case ChangType.Change:
                    if (await this.disk.exist(path)) {
                        if (await this.writeFile(path)) {
                            this.disk._watch.fireChangeSync(path, false);
                        }
                    }
                    break;
                case ChangType.Remove:
                    if (await this.disk.exist(path)) {
                        this.sync?.remove(path);
                        this.disk._watch.fireRename(path, true, false);
                    }
                    break;
                case ChangType.Create:
                    if (!(await this.disk.exist(path))) {
                        await this.writeFile(path);
                        this.disk._watch.fireRename(path, false, false);
                    }
                    break;
                default: break;
            }
        }

    }

    async checkWriteChange () {
        if (Object.keys(this.tempChange).length === 0) return;
        __DEV__ && console.log('sync-manager write', JSON.stringify(this.tempChange, null, 2));
        await Storage.writeChanges(this.tempChange);
        this.tempChange = {};
    }

    clear () {
        clearInterval(this.timer);
        this.offWatch();
    }

}
