/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-24 22:48:19
 * @Description: Coding something
 */

import type { ICommand, IOprateResult } from './command';

// import type { ICommand } from './command';


declare global {
    function registerCommand(command: ICommand): IOprateResult;
}


export {};