/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-24 21:30:56
 * @Description: Coding something
 */


export function isHttpLink (v: string) {
    return /^https?:\/\//.test(v);
}

export async function fetchJson<
    T extends Record<string, any> = Record<string, any>
> (url: string): Promise<T|null> {
    try {
        const v = await fetch(url);
        if (!v.ok) return null;
        const result = await v.json();
        return result;
    } catch (e) {
        return null;
    }
}
export async function fetchText (url: string): Promise<string> {
    try {
        const v = await fetch(url);
        if (!v.ok) return '';
        const result = await v.text();
        return result;
    } catch (e) {
        return '';
    }
}