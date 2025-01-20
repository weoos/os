/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-24 23:00:40
 * @Description: Coding something
 */
import { withResolve } from './utils';

export function executeJS (code: string) {
    const blob = new Blob([ code ], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);

    const script = document.createElement('script');
    script.src = url;

    document.body.appendChild(script);

    const { ready, resolve } = withResolve<boolean>();

    script.onload = () => {
        // 脚本加载并执行完成后，移除script元素
        document.body.removeChild(script);
        URL.revokeObjectURL(url);
        resolve(true);
    };

    script.onerror = () => {
        resolve(false);
    };

    return ready;
}

export function executeJSWithFn<T = void> (code: string, args: Record<string, any> = {}): T {
    const argNames = Object.keys(args);
    const argValues = Object.values(args);
    const fn = new Function(...argNames, code);
    return fn(...argValues);
}