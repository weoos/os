/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-05 19:43:00
 * @Description: Coding something
 */

import type * as Path from 'node:path';
export type NodePath = typeof Path;

export type IFileType = 'empty'|'file'|'dir'|'link';

export interface IFileStats {
    size: number;
    type: IFileType;
    isDirectory(): boolean;
    isFile(): boolean;
    // todo
}

declare global {
    interface Window {

    }
    interface FileSystemDirectoryHandle {
        keys: () => AsyncIterableIterator<string>,
        entries: () => AsyncIterableIterator<[string, FileSystemFileHandle|FileSystemDirectoryHandle]>,
    }
}

export {};