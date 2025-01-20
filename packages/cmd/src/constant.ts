/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-24 23:31:07
 * @Description: Coding something
 */
export const CommandFilesDir = '/WebOS/System/Commands';

export function commandFilePath (name: string) {
    return `${CommandFilesDir}/${name}`;
}

export const MaxCommandNameLength = 100;