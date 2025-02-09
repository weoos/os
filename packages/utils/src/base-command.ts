/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-24 21:10:07
 * @Description: Coding something
 */
import type { ICommand, ICommandInfo, ICommandProvider, IFnMaybe, IPromiseMaybe } from './types';
import type { WebTerm } from 'web-term-ui';

export interface ICommandOptions<T = any> {
    commands: ICommandInfo[];
    disk: T;
    data: string;
    term: WebTerm;
    run: (line: string|ICommandInfo[]) => Promise<boolean|string>;
}

export class BaseCommand<T> implements ICommand<T> {
    name = '';
    helpInfo: IFnMaybe<string> = '';
    helpDetails: IFnMaybe<string> = '';

    term: WebTerm;
    disk: T;
    provider: ICommandProvider;

    activate (disk: T, provider: ICommandProvider) {
        this.disk = disk;
        this.provider = provider;
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    run (cmd: ICommandInfo, options: ICommandOptions<T>): IPromiseMaybe<string> {
        return '';
    }

};