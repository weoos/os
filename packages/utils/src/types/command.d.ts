/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-23 19:42:17
 * @Description: Coding something
 */

import type { IFnMaybe, IPromiseMaybe } from './utils';
import type { WebTerm, ICommandInfo } from 'web-term-ui';

export type { ICommandInfo } from 'web-term-ui';

export type IOprateResult<T extends Record<string, any> = {}> = {
    success: boolean,
    info: string,
} & T;

export interface ICommand<T = any> {
    name: string,
    helpDetails?: IFnMaybe<string>;
    version?: IFnMaybe<string>;
    helpInfo?: IFnMaybe<string>;
    run(cmd: ICommandInfo, context: {
        commands: ICommandInfo[],
        disk: T,
        data: string,
        term: WebTerm,
        run: (line: string|ICommandInfo[]) => Promise<string|boolean>;
    }): IPromiseMaybe<string>,
    activate?(disk: T, provider: ICommandProvider): void;
    dispose?(): void;
}
export interface ICommandProvider<T=any> {
    getPwd: ()=>string;
    onTab?: (value: string, full: string) => IPromiseMaybe<({line?: string, result: string})>,
    onCommand: (commands: ICommandInfo[], methods: {
        setPwd: (v: string) => void;
        clearTerminal: ()=>void;
        getHeader: ()=>string,
        openEditor: (options: {path: string, content: string, save: (v:string)=>void}) => void;
    }) => IPromiseMaybe<string|boolean>
    registerCommand? (command: ICommand<T>): IOprateResult;
    removeCommand? (name: string): IOprateResult;
}

export interface IPos {x: number, y: number}