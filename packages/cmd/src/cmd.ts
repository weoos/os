/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-09 23:10:07
 * @Description: Coding something
 */
import { Disk, getTypeWithData, type IFileType } from '@weoos/disk';

export class CMD {

    static instance: CMD;
    disk: Disk;
    ready: Promise<void>;
    constructor (enableSync = false) {
        // ! 单例模式
        if (CMD.instance) {
            CMD.instance.disk._initSyncAlone(enableSync);
            return CMD.instance;
        }
        CMD.instance = this;

        this.disk = new Disk({
            enableSync
        });
        this.ready = this.disk.ready;
    }

    // ls : 列出目录内容，用于查看文件和文件夹。
    ls (path?: string) {
        return this.disk.ls(path);
    }
    // cd : 切换目录，帮助用户进入不同的文件夹。
    cd (path: string) {
        return this.disk.cd(path);
    }
    // pwd : 显示当前工作目录的绝对路径。
    pwd () {
        return this.disk.pwd();
    }
    // touch : 创建新的空文件。
    touch (path: string) {
        return this.disk.createFile(path);
    }
    // mkdir : 创建新的目录。
    mkdir (path: string) {
        return this.disk.createDir(path);
    }
    // rmdir : 删除空目录。
    rmdir (path: string) {
        return this.disk.remove(path);
    }
    // cp : 复制文件或目录。
    cp (src: string, dest: string) {
        return this.disk.copySingle(src, dest);
    }
    // mv : 移动或重命名文件和目录。
    mv (src: string, dest: string) {
        return this.disk.move(src, dest);
    }
    // rm : 删除文件或目录。
    rm (path: string) {
        return this.disk.remove(path);
    }
    // cat : 查看文件内容，将文件内容输出到终端。
    cat (path: string) {
        return this.disk.readText(path);
    }
    // more : 分屏查看文件内容，适合查看长文件。
    more (path: string) {
        // todo
        return this.disk.readText(path);
    }
    // less : 也是分屏查看文件内容，功能比 more 更强大。
    less (path: string) {
        // todo
        return this.disk.readText(path);
    }
    // head : 查看文件开头的几行内容。
    async head (path: string, line: number) {
        // todo
        const text = await this.disk.readText(path);
        if (!text) return '';
        return text.split('\n').slice(0, line).join('\n');
    }

    // tail : 查看文件结尾的几行内容。
    async tail (path: string, line: number) {
        // todo
        const text = await this.disk.readText(path);
        if (!text) return '';
        return text.split('\n').slice(-line).join('\n');
    }
    // grep : 在文件中搜索指定的字符串。
    // todo
    async grep (path: string, reg: string|RegExp) {
        // todo
        const text = await this.disk.readText(path);
        if (!text) return [ '' ];
        if (typeof reg === 'string') {
            reg = new RegExp(reg, 'g');
        }
        const matches = text.match(reg);
        const result: string[] = [];
        if (!matches) return result;
        for (const item of result) {
            result.push(item[0]);
        }
        return result;
    }
    // find : 在指定目录下查找文件。
    async find (
        path: string, { name, type }: {
            name?: string|RegExp,
            type?: IFileType
        } = {}
    ) {
        const reg = (typeof name === 'string') ? new RegExp(name) : name;
        const results: string[] = [];
        if (this.disk._sync) {
            this.disk._sync.syncMiddleware.traverse(path, ({ path, name }) => {
                let pass = true;
                if (reg && !reg.test(name)) {
                    pass = false;
                }
                if (pass && type) {
                    const fileType = this.disk._sync.syncMiddleware.getType(path);
                    if (fileType !== type) {
                        pass = false;
                    }
                }
                if (pass) {
                    results.push(path);
                }
            });
        } else {
            await this.disk.backend.traverseContent(async (path, content, name) => {
                let pass = true;
                if (reg && !reg.test(name)) {
                    pass = false;
                }
                if (pass && type) {
                    const fileType = getTypeWithData(await content);
                    if (fileType !== type) {
                        pass = false;
                    }
                }
                if (pass) {
                    results.push(path);
                }
            }, path);
        }
        return results;
    }
    // zip : 压缩文件成 zip 格式
    zip (files: string[], target?: string) {
        return this.disk.zip(files, target);
    }
    // unzip : 解压 zip 文件
    unzip (path: string, target?: string) {
        return this.disk.unzip(path, target);
    }
    // tar : 打包和压缩文件。
    tar (files: string[], target?: string) {
        // 暂时使用zip
        return this.disk.zip(files, target);
    }
    // du : 查看文件或目录占用磁盘空间大小。
    async du (path: string) {
        return (await this.disk.stat(path)).size;
    }
    // chmod : 改变文件或目录的权限。
    // chown : 改变文件或目录的所有者。
    // useradd : 添加新用户。
    // userdel : 删除用户。
    // groupadd : 添加用户组。
    // groupdel : 删除用户组。
    // su : 切换用户。
    // sudo : 以其他用户（通常是超级用户）身份执行命令。
    // ps : 查看当前系统中的进程状态。
    // kill : 终止进程。
    // top : 动态显示系统中各个进程的资源占用情况。
    // df : 查看磁盘空间使用情况。
}
