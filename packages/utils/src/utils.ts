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

export function isU8sEqual (u8s1: Uint8Array, u8s2: Uint8Array) {
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

const endMark = Symbol('');

export function runASEnd<T> (value: T) {
    return {
        [endMark]: true,
        value,
    };
}

// 作用是确保同步和异步逻辑可以分别处理，如 writeFile和writeFileSync
export function runAS<T = any> (
    fns: ((prev: any, end: <T>(v?: T)=>T)=>any)[],
): T {

    let isAsync = false;
    let prev: any;
    let resolve: (v: T)=>any;
    let ready: Promise<T>;

    let finish = false;

    const end = (v: any) => {
        finish = true;
        prev = v;
        return v;
    };

    const next = () => {
        const fn = fns.shift();
        if (!fn) return resolve?.(prev);

        let result = fn(prev, end);

        if (result?.[endMark]) {
            result = result.value;
            finish = true;
        }

        if (finish) return resolve?.(result);

        const _next = (result: any) => {
            prev = result;
            next();
        };
        if (result instanceof Promise) {
            if (!isAsync) {
                isAsync = true;
                const p = withResolve();
                ready = p.ready;
                resolve = p.resolve;
            }
            result.then(_next);
        } else {
            _next(result);
        }
    };
    next();
    // @ts-ignore
    return isAsync ? ready : prev;
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