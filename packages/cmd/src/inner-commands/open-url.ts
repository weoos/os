/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-23 19:21:26
 * @Description: Coding something
 */
import type { Disk } from '@weoos/disk';
import type { ICommand, ICommandInfo } from '../types';

export const OpenUrlCommand: ICommand = {
    name: 'open-url',
    helpInfo: 'Open Url in Browser',
    run (cmd: ICommandInfo, options: {commands: ICommandInfo[]; disk: Disk; data: string;}): string {
        const url = cmd.args[0];
        console.log(options);
        let result = 'fail.';
        if (globalThis?.open) {
            globalThis.open(url);
            result = `success!`;
        }
        return `Open "${url || ''}" ${result}`;
    }
};