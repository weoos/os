/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-22 13:04:28
 * @Description: Coding something
 */
import { WebTerm } from 'web-term-ui';
import type { ICommandInfo } from '@weoos/cmd';
import { CommandProvider } from '@weoos/cmd';
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
    }: {
        container?: string|HTMLElement,
        title?: string,
        padding?: number,
    } = {}) {
        // ! 单例模式
        if (WebOS.instance) return WebOS.instance;
        WebOS.instance = this;
        const commandProvider = new CommandProvider();

        this.term = new WebTerm({
            style: { padding },
            title,
            container,
            header: this.header,
        });
        this.commandProvider = commandProvider;

        let saveEdit: (v: string)=>void;

        this.term.on('enter', async content => {
            if (!content) {
                this.term.write(content);
                return;
            }
            const result = await commandProvider.onCommand(
                parseCommand(content), {
                    setPwd: (v) => {
                        this.pwd = v;
                        this.term.setHeader(this.header);
                    },
                    clearTerminal: () => {this.term.clearTerminal();},
                    getHeader: () => this.header,
                    openEditor: ({ path, content, save }) => {
                        this.term.vi(content, `Edit ${path} ("${isMac() ? 'cmd' : 'ctrl'}+s" to save, "esc" to exit)`);
                        saveEdit = save;
                    }
                }
            );
            if (typeof result === 'string') {
                result ? this.term.write(result) : this.term.newLine();
            }
        });
        this.term.on('tab', (v: string) => {
            const range = v.substring(v.lastIndexOf(' ') + 1);
            const data = this.commandProvider.onTab(range, this.term.value);
            const { line, result } = data;
            if (line) this.term.write(line);
            this.term.insertEdit(result);
        });
        this.term.on('edit-done', v => {
            saveEdit?.(v);
            this.term.newLine();
        });
    }

    get registerCommand (): CommandProvider['registerCommand'] {
        return this.commandProvider.registerCommand?.bind(this.commandProvider) || (() => {});
    }
    get removeCommand (): CommandProvider['removeCommand'] {
        return this.commandProvider.removeCommand.bind(this.commandProvider) || (() => {});
    }

}


// todo 解析 rm -rf 类似的 => {rf: true}
function parseCommand (content: string): ICommandInfo[] {

    content = content.trim();

    if (!content) return [];

    const values = content.split('|').map(v => v.trim());
    const commands: ICommandInfo[] = [];
    for (const value of values) {
        const command: ICommandInfo = {
            name: '',
            args: [],
            options: {},
        };
        const arr = value.split(' ');

        command.name = arr.shift() || '';

        let optKey = '';
        for (let item of arr) {
            item = item.trim();
            if (!item) continue;
            if (item[0] === '-') {
                if (optKey) command.options[optKey] = true;
                optKey = item.substring(1);
            } else {
                if (optKey) {
                    if (item[0] === '-') {
                        command.options[optKey] = true;
                        optKey = item.substring(1);
                    } else {
                        command.options[optKey] = item;
                        optKey = '';
                    }
                } else {
                    command.args.push(item);
                }
            }
        }

        if (optKey) {
            command.options[optKey] = true;
        }
        commands.push(command);

        // 正则有点问题
        // const results = value.matchAll(/-(\S*) (\S*)[ $]/g);
        // for (const item of results) {
        //     command.options[item[1]] = item[2];
        //     value = value.replace(item[0], '');
        // }

        // const args = value.split(' ');
        // command.name = args.shift()!;
        // command.args = args;
        // commands.push(command);
    }
    return commands;
}
