/*
 * @Author: chenzhongsheng
 * @Date: 2024-12-26 23:32:50
 * @Description: Coding something
 */

export const TerminalControlKey = {
    '\r': 'Enter',
    '\x7f': 'Backspace',
    '\x1b[A': 'Up',
    '\x1b[B': 'Down',
    '\x1b[D': 'Left',
    '\x1b[C': 'Right',
    '	': 'Tab',
} as const;

export const TerminalKeys = Object.values(TerminalControlKey);

export const TerminalKeysSet = new Set(TerminalKeys);

export type ITerminalKey = typeof TerminalKeys[number]