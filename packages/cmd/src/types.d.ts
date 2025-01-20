/*
import { ICommand } from './types.d';
 * @Author: chenzhongsheng
 * @Date: 2024-11-30 11:30:49
 * @Description: Coding something
 */

import type { Disk } from '@weoos/disk';
import type { ICommand as ICommandBase } from '@weoos/utils';


export type {
    ICommandInfo,
    IOprateResult,
    ICommandProvider
} from '@weoos/utils';

export interface ICommand extends ICommandBase<Disk> {

}

