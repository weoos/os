/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-23 19:21:26
 * @Description: Coding something
 */
import type { ICommand, ICommandInfo } from '../types';

export const OpenUrlCommand: ICommand = {
    name: 'open-url',
    helpInfo: 'Open Url in Browser',
    run (cmd: ICommandInfo): string {
        const url = cmd.args[0];
        let result = 'fail.';
        if (globalThis?.open) {
            globalThis.open(url);
            result = `success!`;
        }
        return `Open "${url || ''}" ${result}`;
    }
};