/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-24 21:10:07
 * @Description: Coding something
 */
import type { Disk } from '@weoos/disk';
import type { ICommand, IOprateResult } from '@weoos/utils';
import { BaseCommand, type ICommandInfo, fetchText, executeJSWithFn, withResolve, parseGithubFile, parseNPMFile, io } from '@weoos/utils';
import { findInnerCommand } from '../entry';
import { MaxCommandNameLength, commandFilePath } from '../../constant';

// todo 下载进度 https://www.cnblogs.com/lxlx1798/articles/16969244.html
export class InstallCommand extends BaseCommand<Disk> {
    name = 'install';

    helpDetails = this._viewDetails;

    // todo add run progress
    async run (cmd: ICommandInfo): Promise<string> {

        const rmCmd = cmd.options['rm'];
        if (rmCmd) {
            return this.removeCommand(rmCmd);
        }

        if (!this.provider.registerCommand) {
            return 'CommandProvider not support Install';
        }

        let command: ICommand, content = '';

        const { name, local, url } = this.parseUrl(cmd);

        if (url) {
            const result = await this._installFromUrl(url);
            if (!result.command) {
                return `Install fail ${url}: ${result.info}`;
            }
            command = result.command;
            content = result.text;
        } else if (name) {
            const result = findInnerCommand(name);
            if (!result) {
                return `Not a Built-in Command: ${name}`;
            }
            command = result;
            content = name;
            const { success, info } = this.provider.registerCommand(command);
            if (!success) {
                return `Install fail: ${info}`;
            }
        } else if (local) {
            const text = this.disk.readTextSync(local);

            if (!text) {
                return `Install from local fail: ${local}`;
            }
            const result = await this._installFromText(text);
            if (!result.command) {
                return `Install from local fail: ${result.info}`;
            }
            command = result.command;
        } else {
            return `Install fail: parse command fail`;
        }

        if (!local) {
            const [ , err ] = await io(this.saveCommand(command, content));
            if (err) return err;
        }

        return `Install ${command.name} success!`;
    }

    private async saveCommand (command: ICommand, content: string) {
        const path = commandFilePath(command.name);
        const createSuccess = await this.disk.createFile(
            path,
            this.disk.createFileContent(content),
            { ensure: true, overwrite: true }
        );
        if (!createSuccess) {
            throw `Save command fail: ${path}`;
        }
    }

    private parseUrl (cmd: ICommandInfo) {
        /**
         * n种安装模式，
         * -ol -online http: https: 开头的通过网络下载安装
         * -gh -github: github地址 通过网络下载安装
         * -npm -github: github地址 通过网络下载安装
         * -l -local: 本地文件
         * -of : 官方地址
         * 内部自定义命令 默认（如果没有会去官方npm包里查找）
         */
        const { args, options } = cmd;

        const value = args[0];
        let url = '';
        let local = '';
        let name = '';
        if (options.ol) {
            url = options.ol as string;
        } else if (options.gh) {
            url = parseGithubFile(options.gh as string);
        } else if (options.npm) {
            url = parseNPMFile(options.npm as string);
        } else if (options.of) {
            // todo 更换仓库名
            url = parseNPMFile(`webos-commands/dist/${options.of}.js`);
        } else if (options.l) {
            local = options.l as string;
        } else {
            name = value;
        }
        return { url, local, name };
    }

    private async removeCommand (name: string|boolean) {
        if (typeof name !== 'string' || name === '') {
            return `Remove fail: name is not valid (${name})`;
        }
        if (!this.provider.removeCommand) {
            return 'CommandProvider not support Install -rm';
        }
        const { success, info } = this.provider.removeCommand(name);
        if (!success) return info;
        await this.disk.remove(commandFilePath(name));
        return `Remove command ${name} success!`;
    }

    private async _installFromUrl (url: string): Promise<IOprateResult<{
        text: string,
        command: ICommand|null
    }>> {
        const script = await fetchText(url);
        const { success, info, command } = await this._installFromText(script);
        return {
            success,
            info,
            text: script,
            command: command || null,
        };
    }

    // 供 cmd loadCommands时调用
    _installFromText (script: string): Promise<IOprateResult<{command?: ICommand}>> {

        if (!this.provider.registerCommand) {
            return Promise.resolve({
                success: false,
                info: 'RegisterCommand not Exists'
            });
        }

        if (script.length <= MaxCommandNameLength) {

            const command = findInnerCommand(script);
            if (command) {
                const result = this.provider.registerCommand(command);
                if (result.success) { Object.assign(result, { command }); }
                return Promise.resolve(result);
            }
        }

        const { ready, resolve } = withResolve<IOprateResult & {command?: ICommand}>();
        executeJSWithFn(script, {
            registerCommand: (command: ICommand) => {
                const result = this.provider.registerCommand!(command);
                if (result.success) { Object.assign(result, { command }); }
                resolve(result);
            }
        });
        setTimeout(() => {
            resolve({ success: false, info: 'Install timeout' });
        }, 2000);
        return ready;
    }

    private _viewDetails () {
        return [
            'install command_name : Install Built-in command',
            'install -ol url : Install from url',
            'install -gh user/repo[/filepath] : Install from github',
            'install -npm pkg_name[/filepath] : Install from npm',
            'install -l filepath : Install from local file',
            'install -rm command_name: Remove command',
        ].join('\r\n');
        // -ol online_url;-l local_file;-gh github_repo;-npm npm_pkg;default is built-in cmd
    }

};

