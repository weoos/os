<!--
 * @Author: chenzhongsheng
 * @Date: 2025-03-02 19:01:50
 * @Description: Coding something
-->
## 0.0.5

- 新增enableSync，disk 中不保留同步逻辑，可以减少内存开销。将同步逻辑放到nodejs中的fs中，有需要是才会有内存中的备份
- 修复 a ab 的 时候直接上屏了 a
- 新增rename
- 其他优化和修复