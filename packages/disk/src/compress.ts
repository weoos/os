import { decompressFromUint8Array, compressToUint8Array } from 'lz-string';

export function compress (data: string): Uint8Array {
    return compressToUint8Array(data);
}

export function decompress (data: Uint8Array): string {
    return decompressFromUint8Array(data);
}