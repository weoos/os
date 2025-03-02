/*
 * @Author: chenzhongsheng
 * @Date: 2024-05-06 17:07:21
 * @Description: Coding something
 */
import JSZip from 'jszip';
import type { Disk } from '../disk';
import { extractSubDir, handlePasteFileNames, pt, splitPathInfo } from '../utils';
import { createSpacialMarker, isTargetType } from '../file-marker';
import type { IOprateResult } from '@weoos/utils';
import { createPromises, mergeU8s } from '@weoos/utils';

const { data: ZipMarkerData } = createSpacialMarker('zip');

export class Zip {
    constructor (public disk: Disk) {}

    async zip (paths: string[], target: string = 'compress.zip'): Promise<IOprateResult> {  // 默认文件名
        target = this.disk.fmtPath(target);

        const zip = new JSZip();
        const { add, run } = createPromises<boolean>();
        for (let path of paths) {
            path = this.disk.fmtPath(path);
            add(this.zipSingleFile(zip, path));
        }
        const results = await run();

        if (!results.find(bool => bool)) return { success: false, info: `zip fail: no files` };

        const data = await zip.generateAsync({ type: 'uint8array' });

        const { parent } = splitPathInfo(target);
        const map = handlePasteFileNames(
            [ target ],
            parent,
            await this.disk.ls(parent) || []
        );
        await this.disk.createFile(map[target], mergeU8s(ZipMarkerData, data));
        return {
            success: true,
            info: map[target],
        };
    }

    private async zipSingleFile (zip: JSZip, path: string) {
        const type = await this.disk.getType(path);
        if (type === 'empty') return false;

        if (type === 'dir') {
            const folder = zip.folder(path);
            if (!folder) return false;
            let paths = await this.disk.ls(path) || [];
            paths = paths.map(name => pt.join(path, name));
            const { add, run } = createPromises();
            for (const path of paths) {
                add(this.zipSingleFile(folder, path));
            }
            await run();
        } else {
            const data = await this.disk.read(path);
            if (!data) return false;
            // @ts-ignore
            const name = path.replace(zip.root, '');
            zip.file(name, data, { binary: true });
        }
        return true;
    }


    async unzip (path: string, target?: string): Promise<{path: string, isDir: boolean}[]> {

        const origin = await this.disk.read(path);
        const data = this.getZipData(origin);
        if (!data) return [];

        path = this.disk.fmtPath(path);

        const files = await this.unzipU8Arr(data);
        target = target ? this.disk.fmtPath(target) : this.disk.current;

        // 记录最外层的文件路径
        const subSet: Set<string> = new Set();
        // 记录所有的映射关系
        const subMap: Record<string, string> = {};
        for (const file of files) {
            const sub = extractSubDir(target, file.path);
            if (sub) {
                subMap[file.path] = sub;
                subSet.add(sub);
            }
        }
        // 处理命名冲突
        const map = handlePasteFileNames(
            Array.from(subSet),
            target,
            await this.disk.ls(target) || []
        );

        const names: {path: string, isDir: boolean}[] = [];
        for (const file of files) {

            let newPath = file.path;
            const sub = subMap[file.path];

            // 替换新路径
            if (sub) {
                const rename = map[sub];
                if (rename) {
                    newPath = newPath.replace(sub, rename);
                }
            }

            if (file.isDir) {
                names.push({ path: newPath, isDir: true });
                await this.disk.createDir(newPath);
            } else {
                names.push({ path: newPath, isDir: false });
                this.disk.createFile(newPath, file.data);
            }
        }

        return names;
    }

    private async unzipU8Arr (data: Uint8Array, onProgress?: (data: IUnZipProgressData)=>void): Promise<IUnZipProgressData[]> {
        const zip = await JSZip.loadAsync(data);
        let count = 0;

        const files = zip.files;
        const curSize = Object.keys(files).length;

        const list: IUnZipProgressData[] = [];

        for (const key in zip.files) {
            const file = zip.files[key];
            const data = await file.async('uint8array');
            count ++;
            const result: IUnZipProgressData = {
                curName: file.name,
                count,
                curIndex: count,
                curSize,
                data,
                path: key,
                isDir: file.dir,
            };
            onProgress?.(result);
            list.push(result);
        }

        return list;
    }

    async isZip (path: string) {
        const data = await this.disk.read(path);
        if (!data) return false;
        return this.isZipData(data);
    }

    private isZipData (data: Uint8Array) {
        return isTargetType(data, ZipMarkerData);
    }

    private getZipData (data: Uint8Array|null) {
        if (data && this.isZipData(data)) {
            return data.slice(ZipMarkerData.byteLength);
        }
        return null;
    }

}

interface IZipProgressData {
    count: number;
    curName: string;
    curIndex: number;
    curSize: number;
    path: string
}
interface IUnZipProgressData extends IZipProgressData {
    data: Uint8Array;
    isDir: boolean;
}
