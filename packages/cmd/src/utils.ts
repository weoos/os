/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-21 17:04:04
 * @Description: Coding something
 */


export function getMaxCommonHead (values: string[], start = 0) {
    // 查找values中头部的最大公共字符串
    if (values.length === 0) return '';
    if (values.length === 1) return values[0];
    let head = values[0].substring(0, start);
    let index = start;
    while (true) {
        const v = values[0][index];
        if (!v) return head;

        for (let i = 1; i < values.length; i++) {
            if (values[i][index] !== v) {
                return head;
            }
        }
        head += v;
        index ++;
    }
}