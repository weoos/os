/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-22 22:36:29
 * @Description: Coding something
 */
import type {
    IOprateResult,
    ICommandInfo, ICommandProvider
} from './types';
import { splitPathInfo, type ICommand, asyncAll, runPromiseMaybe, runFnMaybe, encode, parseCommand } from '@weoos/utils';
import { CMD } from './cmd';
import { getMaxCommonHead } from './utils';
import { InstallCommand } from './inner-commands/install/install-commnd';
import { CommandFilesDir, MaxCommandNameLength, commandFilePath } from './constant';

const CMD_HELP_MAP = {
    clear: 'Clear the terminal.',
    ls: 'View all the files under the folder.',
    mkdir: 'Create a new directory.',
    cd: 'Change the current working directory and switch the displayed PWD in the terminal.',
    pwd: 'Display the current working directory.',
    rm: 'Remove a file.',
    rmdir: 'Remove a directory.',
    cat: 'Display the content of a file.',
    touch: 'Create a new empty file or update the access and modification times of an existing file.',
    echo: 'Output the joined content of the provided arguments.',
    vi: 'Edit file',
    mv: 'Move or rename a file or directory from one location to another.',
    cp: 'Copy a file or directory from one location to another.',
    more: 'Display the content of a file in a paginated way (with limited functionality compared to less).',
    less: 'Display the content of a file in a paginated way with more functionality like scrolling back and forth.',
    head: 'Display the first few lines of a file (the number of lines is specified by an argument).',
    tail: 'Display the last few lines of a file (the number of lines is specified by an argument).',
    grep: 'Search for a specific pattern in files and return the matching lines.',
    find: 'Search for files or directories based on certain conditions and return the results.',
    zip: 'Compress files and directories into a zip file.(-t for compress file name)',
    unzip: 'Extract the contents of a zip file.(unzip zip_file target_dir)',
    tar: 'Compress files and directories into a zip file.',
    du: 'Display the disk usage of a file or directory.',
    help: 'Show commands information.',
};

function CMDHelpInfo () {
    const map: string[] = [];
    const keys = Object.keys(CMD_HELP_MAP);

    let maxLen = 0;
    for (const key of keys) {
        if (key.length > maxLen) maxLen = key.length;
    }
    for (const k in CMD_HELP_MAP) {
        map.push(`${k.padEnd(maxLen, ' ')} : ${CMD_HELP_MAP[k]}`);
    }
    return map.join('\r\n');
};

type ICommandType = keyof typeof CMD_HELP_MAP;

const NotDirText = 'Target is not a directory.';
const ExistsText = 'Target is already exists.';

export class CommandProvider implements ICommandProvider {
    cmd: CMD;
    name: string;

    thirdCommands: Record<string, ICommand> = {};

    private installCommand: InstallCommand;

    constructor (
        enableSync: boolean,
        public methods: Parameters<ICommandProvider['onCommand']>[1]
    ) {
        this.cmd = new CMD(enableSync);

        this.installCommand = new InstallCommand();
        // 安装默认插件
        this.registerCommand(this.installCommand);

        this._loadCommands();
    }

    getPwd () {
        return this.cmd.pwd();
    }

    get disk () {
        return this.cmd.disk;
    }


    async onCommand (content: string|ICommandInfo[]): Promise<string|boolean> {
        const commands = typeof content === 'string' ? parseCommand(content) : content;
        if (commands.length === 0) {
            return this.methods.getHeader();
        }
        let prev = '';
        for (const item of commands) {
            let result: string|boolean;
            try {
                result = await this.runSingleCommand(item, prev, commands);
            } catch (e) {
                console.error(e);
                result = e.toString();
            }
            __DEV__ && console.log('onCommand result', result);
            if (!result && typeof result !== 'string') {
                return false;
            }
            prev = typeof result === 'boolean' ? '' : result;
        }
        return prev;
    }

    async runSingleCommand (
        cur: ICommandInfo,
        prev: string,
        commands: ICommandInfo[],
    ): Promise<string|boolean> {

        const { clearTerminal, setPwd, openEditor } = this.methods;
        // return `execute ${command} ${args.toString()}`;
        const { name, args, options } = cur;
        let result: boolean|string = '';
        const [ arg0, arg1 ] = args;
        const { cmd } = this;

        switch (name as ICommandType) {
            case 'vi':
                if (!arg0) return `Target is empty`;
                if (!await this.disk.exist(arg0)) return `Target file not exists: ${arg0}`;
                if (await this.disk.isDir(arg0)) return `Target is Not File: ${arg0}`;
                const v = await cmd.cat(arg0);
                if (v === null) return `Open file fail: ${arg0}`;
                openEditor({
                    path: this.disk.fmtPath(arg0),
                    content: v,
                    save: (content) => {
                        this.disk.write(arg0, encode(content));
                    }
                });
                return false;
            case 'clear': clearTerminal(); return false;

            case 'ls':
                const ls = (await cmd.ls(arg0))?.join(' ');
                result = (typeof ls !== 'string') ? NotDirText : (ls || ' '); // ! 为空给一个空格占位
                break;
            case 'mkdir': await cmd.mkdir(arg0); break;
            case 'cd': {
                if (await cmd.cd(arg0)) {
                    setPwd(cmd.pwd());
                } else {
                    result = NotDirText;
                }
            }; break;
            case 'pwd': result = cmd.pwd(); break;
            case 'rm': {
                // todo rm -rf
                await cmd.rm(arg0);
            }; break;
            case 'rmdir': if (!await cmd.rmdir(arg0)) {
                result = ExistsText;
            }; break;
            case 'cat': result = await cmd.cat(arg0) || ''; break;
            case 'touch': if (!await cmd.touch(arg0)) {
                result = ExistsText;
            }; break;
            case 'echo': {
                result = this.handleEchoCmd(args);
            }; break;
            case 'mv': await cmd.mv(arg0, arg1); break;
            case 'cp': await cmd.cp(arg0, arg1); break;
            case 'more': result = await cmd.more(arg0) || ''; break;
            case 'less': result = await cmd.less(arg0) || ''; break;
            case 'head': result = await cmd.head(arg0, parseInt(arg1)) || ''; break;
            case 'tail': result = await cmd.tail(arg0, parseInt(arg1)) || ''; break;
            case 'grep': result = (await cmd.grep(arg0, arg1)).join('\r\n'); break;
            case 'find': result = (await cmd.find(arg0, options)).join('\r\n'); break;
            case 'zip':
            case 'tar': // todo 暂时建议处理
                const { success, info } = await cmd.zip(args, options.t as string);
                result = success ? `Zip to ${info}` : info;
                break;
            case 'unzip': await cmd.unzip(arg0, arg1); break;
            case 'du': result = `size = ${await cmd.du(arg0)}`; break;

            case 'help': result = CMDHelpInfo(); break;

            default:
                const command = this.thirdCommands[name];
                if (command) {
                    if (command.helpDetails && (cur.options['d'])) {
                        // ! 当有helpDetails 时
                        result = runFnMaybe(command.helpDetails);
                    } else if (command.version && (cur.options['v'] || cur.options['version'])) {
                        result = runFnMaybe(command.version);
                    } else {
                        result = await runPromiseMaybe(
                            command.run(cur, {
                                commands,
                                disk: this.disk,
                                data: prev,
                                term: (command as any).term,
                                run: (line: string|ICommandInfo[]) => {
                                    return this.onCommand(line);
                                }
                            })
                        );
                    }
                } else {
                    result = `${name}: Command not found`;
                }
                break;
        }
        return result;
    }

    private handleEchoCmd (args: string[]) {

        let index = args.indexOf('>');
        let append = false;

        if (index === -1) {
            index = args.indexOf('>>');
            if (index !== -1) {
                append = true;
            }
        }

        if (index === -1) {
            return args.join(' ');
        }

        const path = args[index + 1];
        if (!path) {
            return args.join(' ');
        }

        this.disk[append ? 'appendSync' : 'writeSync'](
            path,
            encode(args.slice(0, index).join(' ')),
        );
        return '';
    }

    async onTab (range: string, before: string) {
        // todo 修复 a ab 的 时候直接上屏了 a
        // 是否是对命令进行提示
        const isCommandTab = !before.includes(' ');

        let name = '', parent = '', options: string[] = [];

        if (isCommandTab) {
            // 对命令进行提示
            name = range;
            options = Object.keys(CMD_HELP_MAP);
        } else {
            const info = splitPathInfo(range);
            name = info.name;
            parent = info.parent;
            options = await this.cmd.ls(parent) || [];
            // console.log('onTab files', options, range, parent, name);
        }

        const results = options.filter(item => item.startsWith(name));
        let common = getMaxCommonHead(results, name.length);

        let line = '';
        if (name === common && results.length > 1) {
            line = results.join(' ');
        } else {
            if (!isCommandTab) {
                // 如果是文件夹补齐后面的 /
                const commonPath = `${parent}${parent ? '/' : ''}${common}`;
                if (common && await this.cmd.disk.isDir(commonPath)) {
                    common += '/';
                }
                // console.log(`tab="${value}" parent="${parent}", name="${name}" common="${common}"`);
            } else {
                if (results.length === 1) {
                    common += ' '; // 补齐命令tab模式后面的空格
                }
            }
        }
        return {
            line,
            result: common.replace(name, '')
        };

    }

    registerCommand (command: ICommand): IOprateResult {

        if (command.name.length > MaxCommandNameLength) return {
            success: false,
            info: `Command name should less then ${MaxCommandNameLength}: ${command.name}`
        };
        if (!CMD_HELP_MAP[command.name]) {
            this.thirdCommands[command.name] = command;
            let helpInfo = runFnMaybe(command.helpInfo);
            if (!helpInfo) {
                helpInfo = !!command.helpDetails ?
                    `Run '${command.name} -d' to view details` :
                    `${command.name} <args>.`;
            }
            CMD_HELP_MAP[command.name] = helpInfo;
            command.activate?.(this.disk, this);
            return { success: true, info: 'Register success' };
        }
        return { success: false, info: `Command already exists ${name}` };
    }

    removeCommand (name: string): IOprateResult {
        if (name in this.thirdCommands) {
            const command = this.thirdCommands[name];
            delete this.thirdCommands[name];
            delete CMD_HELP_MAP[name];
            command.dispose?.();
            return { success: true, info: 'Remove success' };
        } else if (name in CMD_HELP_MAP) {
            return { success: false, info: `Cannot remove built-in command: ${name}` };
        }
        return { success: false, info: `Command ${name} not exists` };
    }

    private async _loadCommands () {
        await this.disk.ready;

        if (!await this.disk.exist(CommandFilesDir)) return;

        const files = await this.disk.ls(CommandFilesDir);

        if (!files) return;

        const all = asyncAll();

        for (const name of files) {
            const path = commandFilePath(name);
            if (await this.disk.isDir(path)) continue;
            const content = await this.disk.readText(path);
            if (!content) continue;
            all.add(this.installCommand._installFromText(content));
        }

        await all.run();
    }
}
