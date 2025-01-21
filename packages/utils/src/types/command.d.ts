/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-23 19:42:17
 * @Description: Coding something
 */

import type { IFnMaybe, IPromiseMaybe } from './utils';


export interface ICommandInfo {
    name: string;
    args: string[];
    options: Record<string, string|boolean>;
}
export type IOprateResult<T extends Record<string, any> = {}> = {
    success: boolean,
    info: string,
} & T;

export interface ICommand<T = any> {
    name: string,
    helpDetails?: IFnMaybe<string>;
    helpInfo?: IFnMaybe<string>;
    run(cmd: ICommandInfo, options: {
        commands: ICommandInfo[],
        disk: T,
        data: string,
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