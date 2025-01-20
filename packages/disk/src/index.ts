/*
 * @Author: chenzhongsheng
 * @Date: 2024-10-10 17:22:08
 * @Description: Coding something
 */
import './types.d';
import _localforage from 'localforage';

export * from './disk';

export * from './utils';
export { pt as path } from './utils';
export * from '../../cmd/src/cmd';

export * from './types.d';

export {} from '@weoos/utils';

export const localforage = _localforage;

