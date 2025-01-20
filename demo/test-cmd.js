/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-25 11:37:38
 * @Description: Coding something
 */
registerCommand({
    name: 'test-cmd',
    helpInfo: 'Test Command.',
    run (cmd) {
        return `Test Command ${JSON.stringify(cmd)}`;
    }
});