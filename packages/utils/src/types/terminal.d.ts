/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-26 21:03:21
 * @Description: Coding something
 */

import type { ITerminalKey } from '../constant';
import type { ICommandInfo } from './command';
import type { IPromiseMaybe } from './utils';

export interface ITerminalEditor {
    addRecord(v: string): void;
    clearRecord(): void;
    edit(v: string): void;
    back(): void;
    onKey(key: ITerminalKey, v?: string): boolean;
	initTerminalManager(manager: ITerminalManager): void;
	isEditing: boolean;
}

export interface ITerminalInfo {
	x: number,
	y: number,
	length: number,
	rows: number,
	cols: number,
}

export interface ITerminalProvider {
    editor?: ITerminalEditor;
    title?: string;
    write(data: string): void;
    getHeader (): string;
    onTab? (value: string, full: string): IPromiseMaybe<string>;
    onCommand? (commands: ICommandInfo[]): IPromiseMaybe<string|boolean>;
    onEnter? (line: string): IPromiseMaybe<string|boolean>;
    onData (ln: (data: string) => void): void;
    getTermInfo(): ITerminalInfo;
}

export interface ITerminalManager {
	name: string;
	line: string;
	cursorIndex: number;
	provider: ITerminalProvider;
	get header(): string;
	clear(pure?: boolean): void;
	setCursorPos(x: number, y: number): void;
	write(data: string): void;
	writeLine(text: string, lines?: number): void;
	writeEmptyLine(): void;
	cursorMove(count?: number): number;
	cursorMoveToTail(): void;
	cursorMoveToHead(): void;
	replaceCurrentLine(value: string): void;
	delete(count?: number): void;
	deleteAll(): void;
	onHandleTerminalData(data: string): Promise<void>;
	insertLine(content: string): void;
}