# Reference diff

未找到可信的 CMS079 reference。

`result/cms079-reference-index.md` 里的公开材料要么是服务端源码，要么是会改 HackShield / CRC / `ijl15.dll` 的注入器，要么是没有哈希、作者自己标明来源不可考的脱壳包。这些都不能用来对齐节区、导入表、RTTI 或 `ZtlTaskMem*`。

因此没有做函数映射，也没有把别的版本的地址套到当前 V5 上。`result/reference-function-map.csv` 只有表头。
