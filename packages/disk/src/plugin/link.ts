/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-08 10:54:39
 * @Description: Coding something
 */
import type { SyncMiddleware } from '../sync-middleware/sync-middleware';
import { getTypeWithData, parseLinkTarget } from '../file-marker';
import type { IDiskBankEnd } from '../backend/storage';
import type { Disk } from '../disk';
import { withResolve } from '@weoos/utils';

export const link = syncBase();
export const linkSync = syncBase(true);

function syncBase (isSync = false) {
    return function (
        $1: any, key: string,
        descriptor: PropertyDescriptor
    ) {
        const origin = descriptor.value;


        descriptor.value = function (this: Disk, ...args: any[]) {
            const path = this.fmtPath(args[0] || '');

            const fn = (target: string) => {
                args[0] = target || path;
                return origin.apply(this, args);
            };

            if (isSync) {
                const target = this._link.getSync(path);
                return fn(target);
            } else {
                const { ready, resolve } = withResolve();
                this._link.get(path).then(target => {
                    return fn(target);
                }).then(result => {
                    resolve(result);
                });
                return ready;
            }
        };
    };
}

export class Link {

    constructor (
        public backend: IDiskBankEnd,
        public syncMiddleware?: SyncMiddleware
    ) {
    }

    async get (path: string, data?: Uint8Array) {
        const u8s = data || (await this.backend.read(path)!);
        return this._get(u8s!);
    }
    getSync (path: string, data?: Uint8Array) {
        const u8s = data || (this.syncMiddleware?.read(path)!);
        return this._get(u8s);
    }

    private _get (u8s: Uint8Array) {
        const type = getTypeWithData(u8s);
        if (type === 'link') {
            return parseLinkTarget(u8s);
        }
        return '';
    }
}