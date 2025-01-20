/*
 * @Author: chenzhongsheng
 * @Date: 2025-01-17 23:04:27
 * @Description: Coding something
 */
import localforage from 'localforage';

function randomId (head = '') {
    return `${head}${Date.now().toString().substring(5)}-${Math.random().toString(16).substring(2)}`;
}

const store = localforage.createInstance({
    name: 'weoos-messenger',
    driver: localforage.INDEXEDDB,
});
export const storage = store;

const MsgKey = 'weoos-messenger';
const DefaultInterval = 500;

export interface IMessage<Key = any, Data = any> {
    id: string,
    from: string,
    ts: number,
    type: Key,
    data: Data,
}

export class WeoOSEvent<
    IMessageMap extends Record<string, any> = Record<string, any>,
> {

    id: string;
    private lns: Record<keyof IMessageMap, ((data: any, info: IMessage)=>void)[]> = {} as any;

    private timer = null as any;

    constructor ({ id, interval = DefaultInterval }: {
        id?: string,
        interval?: number,
    }) {
        this.id = id || randomId('ms');

        this.timer = setInterval(() => {
            this.checkMessage();
        }, interval);
    }


    on<T extends keyof IMessageMap> (key: T, listener: (data: IMessageMap[T], info: IMessage<T>)=>void) {
        let list = this.lns[key];
        if (!list) {
            list = this.lns[key] = [];
        }
        list.push(listener);
    }

    async emit<T extends keyof IMessageMap> (key: T, data?: IMessageMap[T]) {
        const list = await this._read();
        // @ts-ignore
        const item: IMessage<T> = {
            ts: Date.now(),
            id: randomId(),
            from: this.id,
            type: key,
            data,
        };
        if (list.length === 0) {
            list.push(item);
        } else {
            // ! 按时间顺序插入
            const index = list.findIndex(v => v.ts > item.ts);
            if (index === -1) {
                list.push(item);
            } else {
                list.splice(index, 0, item);
            }
        }
        await this._write(list);
    }

    async _read (): Promise<IMessage<any>[]> {
        return (await store.getItem(MsgKey)) || [];
    }

    _write (list: IMessage<any>[]) {
        return store.setItem(MsgKey, list);
    }

    triggerMsg = new Set<string>();
    async checkMessage () {
        const data = await this._read();
        if (data.length === 0) return;

        const removeIndexes: number[] = [];
        const now = Date.now();
        const isOutDate = (time: number) => (now - time) > DefaultInterval * 2;

        const messages: IMessage<any>[] = [];

        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            if (isOutDate(item.ts)) {
                removeIndexes.push(i);
                this.triggerMsg.delete(item.id);
                continue;
            }
            if (item.from === this.id) continue; // 忽略自身变更
            if (this.triggerMsg.has(item.id)) continue;
            // 按时间覆盖
            messages.push(item);
            this.triggerMsg.add(item.id);
        }

        // ! 清理过期记录
        if (removeIndexes.length) {
            for (let i = removeIndexes.length - 1; i >= 0; i--) {
                data.splice(removeIndexes[i], 1);
            }
            await this._write(data);
        }

        // 此处异步即可
        for (const message of messages) {
            const { type, data } = message;
            const list = this.lns[type];
            if (list?.length) {
                for (const fn of list) {
                    fn(data, message);
                }
            }
        }
    }

    destroy () {
        clearInterval(this.timer);
        this.lns = {} as any;
    }
}