/*
 * @Author: chenzhongsheng
 * @Date: 2024-11-30 11:30:49
 * @Description: Coding something
 */

export type IPromiseData<T extends Promise<any>> = T extends Promise<infer U> ? U: any;

export type IPromiseMaybe<T=any> = Promise<T>|T;

export type IFnMaybe<T=any> = T|(()=>T);

