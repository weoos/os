/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-23 20:08:32
 * @Description: Coding something
 */
export { OpenUrlCommand } from './open-url';
import type { ICommand } from '@weoos/utils';
import { OpenUrlCommand } from './open-url';

export const InnerCommands: ICommand[] = [
    OpenUrlCommand,
];

export function findInnerCommand (name: string): ICommand|null {
    return InnerCommands.find(item => item.name === name) || null;
}