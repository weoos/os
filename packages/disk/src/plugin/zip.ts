/*
 * @Author: chenzhongsheng
 * @Date: 2024-05-06 17:07:21
 * @Description: Coding something
 */
import JSZip from 'jszip';
import type { Disk } from '../disk';
import NPath from 'path';
import { handlePasteFileNames, splitPathInfo } from '../utils';
import { createSpacialMarker, isTargetType } from '../file-marker';
import { mergeU8s } from '@weoos/utils';

const { data: ZipMarkerData } = createSpacialMarker('zip');

export class Zip {
    constructor (public disk: Disk) {}

    async zip (paths: string[], target: string = 'compress.zip') {  // 默认文件名
        target = this.disk.fmtPath(target);

        const zip = new JSZip();
        for (let path in paths) {
            path = this.disk.fmtPath(path);
            this.zipSingleFile(zip, path);
        }
        const data = await zip.generateAsync({ type: 'uint8array' });

        const { parent } = splitPathInfo(target);
        const map = handlePasteFileNames(
            [ target ],
            parent,
            this.disk.lsSync(parent) || []
        );
        this.disk.createFile(map[target], mergeU8s(ZipMarkerData, data));
    }

    private zipSingleFile (zip: JSZip, path: string) {
        const type = this.disk.syncMiddleware.getType(path);
        if (type === 'empty') return;

        if (type === 'dir') {
            const folder = zip.folder(path);
            if (!folder) return;
            let paths = this.disk.lsSync(path) || [];
            paths = paths.map(name => NPath.join(path, name));
            for (const path of paths) {
                this.zipSingleFile(folder, path);
            }
        } else {
            const data = this.disk.readSync(path);
            if (!data) return;
            zip.file(path, data, { binary: true });
        }
    }


    async unzip (path: string, target?: string) {

        const origin = this.disk.readSync(path);
        const data = this.getZipData(origin);
        if (!data) return;

        path = this.disk.fmtPath(path);

        const files = await this.unzipU8Arr(data);
        target = target ? this.disk.fmtPath(target) : this.disk.current;

        const sources: string[] = [];

        for (const file of files) {
            // 只需要对最外层的文件进行重命名冲突
            if (file.path.indexOf('/') === -1) {
                sources.push(file.path);
            }
        }
        const map = handlePasteFileNames(
            sources,
            target,
            this.disk.lsSync(target) || []
        );
        for (const file of files) {

            const { parent, path } = splitPathInfo(file.path);
            let fullPath = map[parent];

            if (parent) {
                fullPath = path.replace(parent, fullPath);
            }

            if (file.isDir) {
                await this.disk.createDir(fullPath);
            } else {
                this.disk.createFile(file.path, file.data);
            }
        }

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

    isZip (path: string) {
        const data = this.disk.readSync(path);
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
