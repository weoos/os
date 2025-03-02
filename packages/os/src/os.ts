/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-22 13:04:28
 * @Description: Coding something
 */
import { WebTerm } from 'web-term-ui';
import type { IOprateResult } from '@weoos/cmd';
import { CommandProvider } from '@weoos/cmd';
import type { ICommand } from '@weoos/utils';
import { isMac } from '@weoos/utils';

export class WebOS {
    term: WebTerm;

    pwd: string = '/';

    commandProvider: CommandProvider;

    get disk () {
        return this.commandProvider.disk;
    }

    get header () {
        return `${this.pwd} admin$ `;
    }

    static instance: WebOS;
    constructor ({
        container,
        title = 'Welcome to WebOS! Try running "help".\n',
        padding = 10,
        enableSync = false,
    }: {
        container?: string|HTMLElement,
        title?: string,
        padding?: number,
        enableSync?: boolean,
    } = {}) {
        // ! 单例模式
        if (WebOS.instance) {
            WebOS.instance.disk._initSyncAlone(enableSync);
            return WebOS.instance;
        }
        WebOS.instance = this;

        const commandProvider = new CommandProvider(enableSync, {
            setPwd: (v) => {
                this.pwd = v;
                this.term.setHeader(this.header);
            },
            clearTerminal: () => {this.term.clearTerminal();},
            getHeader: () => this.header,
            openEditor: ({ path, content, save }) => {
                const editor = this.term.edit(content, {
                    title: `Edit ${path} ("${isMac() ? 'cmd' : 'ctrl'}+s" to save, "esc" to exit)`
                });
                editor.on('edit-done', v => {
                    save(v);
                    this.term.newLine();
                });
            }
        });

        this.term = new WebTerm({
            style: { padding },
            title,
            container,
            header: this.header,
        });
        this.commandProvider = commandProvider;
        this.term.on('enter', async content => {
            if (!content) {
                this.term.write(content);
                return;
            }
            const result = await commandProvider.onCommand(content);
            __DEV__ && console.log('enter', result);
            if (typeof result === 'string') {
                result ? this.term.write(result) : this.term.newLine();
            }
        });
        this.term.on('tab', async (before) => {
            const range = before.substring(before.lastIndexOf(' ') + 1);
            const data = await this.commandProvider.onTab(range, before);
            const { line, result } = data;
            if (line) {
                this.term.write(line, { clear: false });
            }
            this.term.insertText(result);
        });
    }

    registerCommand (command: ICommand): IOprateResult {
        // @ts-ignore 注入terminal
        command.term = this.term;
        return this.commandProvider.registerCommand(command);
    }
    get removeCommand (): CommandProvider['removeCommand'] {
        return this.commandProvider.removeCommand.bind(this.commandProvider) || (() => {});
    }
}
