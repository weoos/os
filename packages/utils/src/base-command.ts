/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-24 21:10:07
 * @Description: Coding something
 */
import type { ICommand, ICommandInfo, ICommandProvider, IFnMaybe, IPromiseMaybe } from './types';

export class BaseCommand<T> implements ICommand<T> {
    name = '';
    helpInfo: IFnMaybe<string> = '';
    helpDetails: IFnMaybe<string> = '';

    disk: T;
    provider: ICommandProvider;

    activate (disk: T, provider: ICommandProvider) {
        this.disk = disk;
        this.provider = provider;
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    run (cmd: ICommandInfo, options: {commands: ICommandInfo[]; disk: T; data: string;}): IPromiseMaybe<string> {
        return '';
    }

};