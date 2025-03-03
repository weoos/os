import type { IPos } from './types';
import type { IPromiseData, IPromiseMaybe } from './types/utils';

export { parseCommand } from 'web-term-ui';

/*
 * @Author: chenzhongsheng
 * @Date: 2024-11-29 21:41:08
 * @Description: Coding something
 */
export function notImplemented () {
    console.log('Not implemented');
}
export function notImplementedAsync<T = any> (): Promise<T> {
    console.log('Not implemented');
    return Promise.resolve('' as any);
}

export function attachTarget (obj: any, target: any) {
    if (!Object.isExtensible(target)) {
        [ obj, target ] = [ target, obj ];
    }
    for (const key in obj) {
        const value = obj[key];
        if (typeof value === 'function') {
            target[key] = value.bind(obj);
        } else {
            Object.defineProperty(target, key, {
                get () {
                    return obj[key];
                },
                set (value) {
                    obj[key] = value;
                },
            });
        }
    }
}

export function withResolve<T = any, Err = any> () {
    let resolve!: (data?: T) => void;
    let reject!: (Err?: Err) => void;
    const ready = new Promise<T>((res, rej) => {
        // @ts-ignore
        resolve = res;
        reject = rej;
    });
    return { ready, resolve, reject };
}

export function mergeU8s (...u8s: Uint8Array[]) {
    let len = 0;
    for (const u8 of u8s) len += u8.length;
    const result = new Uint8Array(len);
    let offset = 0;
    for (const u8 of u8s) {
        result.set(u8, offset);
        offset += u8.length;
    }
    return result;
}

export function isU8sEqual (u8s1: Uint8Array, u8s2: Uint8Array|null) {
    if (!u8s1 || !u8s2) return false;
    const n1 = u8s1.byteLength;
    if (n1 !== u8s2.byteLength) return false;
    for (let i = 0; i < n1; i++) {
        if (u8s1[i] !== u8s2[i]) return false;
    }
    return true;
}

export function copyU8s (u8s: Uint8Array) {
    return new Uint8Array(u8s);
}

export async function io<T extends Promise<any>> (promise: T)
    :Promise<[
        IPromiseData<T>,
        any
    ]>
{
    try {
        return [ (await promise) as any, null ];
    } catch (err) {
        return [ {} as any, err ];
    }
}

let _encoder: TextEncoder;
export function encode (v: string) {
    if (!_encoder) {_encoder = new TextEncoder();}
    return _encoder.encode(v);
}

let _decoder: TextDecoder;
export function decode (v: Uint8Array) {
    if (!_decoder) {_decoder = new TextDecoder();}
    return _decoder.decode(v);
}

export async function runPromises (ps: (()=>Promise<any>)[]) {
    for (let i = 0; i < ps.length; i++) {
        await ps[i]();
    }
}

export function createPromises<T=any> () {
    const promises: (Promise<T>)[] = [];
    return {
        add: (v: Promise<T>) => {
            promises.push(v);
        },
        run: () => {
            return Promise.all(promises);
        }
    };
}
type DebounceFunction<T extends (...args: any[]) => any> = (
    this: ThisParameterType<T>,
   ...args: Parameters<T>
) => void;

export function debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
): DebounceFunction<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            func.apply(this, args);
            timer = null;
        }, delay);
    };
}


export function splitPathInfo (path: string): {path: string, parent: string, name: string} {
    if (path === '/') return { path, parent: path, name: '' };
    if (path.endsWith('/')) {
        return splitPathInfo(path.substring(0, path.length - 1));
    }

    const index = path.lastIndexOf('/');

    if (index === -1) return { path, parent: '', name: path };

    return {
        path,
        parent: path.substring(0, index) || '/',
        name: path.substring(index + 1),
    };
}

export function asyncAll<T = any> () {
    const promise: Promise<T>[] = [];
    return {
        add (pro: Promise<T>) {
            promise.push(pro);
        },
        run () {
            return Promise.all(promise);
        }
    };
}

export async function runPromiseMaybe<T = any> (v: IPromiseMaybe<T>) {
    return v instanceof Promise ? await v : v;
}

export function runFnMaybe<T> (v: T|(()=>T)): T {
    // @ts-ignore
    return typeof v === 'function' ? v() : v;
}

export function mergePositions (...ps: IPos[]) {
    if (ps.length === 0) throw new Error('mergePositions fail');
    const v = ps.shift()!;
    for (const p of ps) {
        v.x += p.x;
        v.y += p.y;
    }
    return v;
}

export function mergeText (target: string, addon: string, index?: number) {
    if (typeof index === 'undefined') return target + addon;
    return target.substring(0, index) + addon + target.substring(index);
}

export function removeText (text: string, index: number) {
    return text.substring(0, index) + text.substring(index + 1);
}

export function geneText (size: number, fill: string) {
    return new Array(size).fill(fill).join('');
}
export function isMac () {
    return navigator.userAgent.includes('Macintosh');
}