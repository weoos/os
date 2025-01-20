/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-07 19:07:51
 * @Description: Coding something
 */
import { copyU8s, decode, encode, isU8sEqual, mergeU8s } from '@weoos/utils';
import type { IFileType } from './types';
// import { compress, decompress } from './compress';
import { clearPath } from './utils';

export const SpacialMarker = '_$*%#@♧⊙'; // 用来标记存储的是文件

export function createSpacialMarker (info: string) {
    const marker = `${info}-${SpacialMarker}`;
    const data = encode(marker);

    return {
        data,
        length: data.byteLength,
    };
}

export const createDirContent = () => createSpacialMarker('dir');
export const createLinkContent = () => createSpacialMarker('link');

export const { data: DirMarkerData, length: DirMarkerLen } = createDirContent(); // 用来标记存储的是目录

export const { data: LinkMarkerData, length: LinkMarkerLen } = createSpacialMarker('link'); // 用来标记存储的是软链

export function getTypeWithData (data: Uint8Array|null): IFileType {
    if (!data) return 'empty';
    if (isU8sEqual(data, DirMarkerData)) {
        return 'dir';
    }
    if (isTargetType(data, LinkMarkerData)) {
        return 'link';
    }
    return 'file';
}

export function isTargetType (data: Uint8Array, head: Uint8Array) {
    const len = head.byteLength;
    if (data.byteLength >= len) {
        if (isU8sEqual(data.slice(0, len), head)) {
            return true;
        }
    }
    return false;
}

export function createFileContent (type: IFileType, data?: Uint8Array|string) {
    if (type === 'empty') return new Uint8Array([]);
    if (type === 'dir') {
        return copyU8s(DirMarkerData);
    }

    const u8s = (typeof data === 'string') ? encode(
        type === 'link' ? clearPath(data) : data // ! link 存储的是路径 需要clearPath
    ) : data!;
    if (type === 'link') {
        return mergeU8s(LinkMarkerData, u8s);
    }
    return u8s;
}

export function parseLinkTarget (data: Uint8Array) {
    return decode(data.slice(LinkMarkerLen));
}

export function readFileContent (data: Uint8Array) {
    const type = getTypeWithData(data);

    if (type === 'empty' || type === 'file') return { type, data };

    if (type === 'dir') return { type, data: null };

    return { type, data: parseLinkTarget(data) };
}

