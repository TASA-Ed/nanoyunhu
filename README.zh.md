<p align="center">
	<a href="https://github.com/TASA-Ed/nanoyunhu" target="_blank" rel="noopener noreferrer">
		<img src="https://socialify.git.ci/TASA-Ed/nanoyunhu/image?custom_description=NanoYunHu%2C+Headless+YunHu.&description=1&font=Inter&forks=1&issues=1&language=1&logo=https%3A%2F%2Fwww.tasaed.top%2Fblog%2Fassets%2Flogos%2FT832.png&name=1&owner=1&pattern=Plus&pulls=1&stargazers=1&theme=Auto" alt="nanoyunhu" width="640" height="320" />
	</a>
</p>

<p align="center">
<a href="https://github.com/TASA-Ed/nanoyunhu/releases"><img alt="GitHub release" src="https://img.shields.io/github/v/release/TASA-Ed/nanoyunhu.svg?style=flat-square&include_prereleases"/></a>
</p>

[English](README.md)

## 使用

### 安装 Node.js

参考 [https://nodejs.org/zh-cn/download](https://nodejs.org/zh-cn/download) 。

#### Termux

```bash
pkg install nodejs-lts

corepack enable pnpm
```

### 下载发行版

> 与 [克隆项目](#克隆项目) 之间二选一

前往 [发行版](https://github.com/TASA-Ed/nanoyunhu/releases) 页面下载最新版本。

并解压到 nanoyunhu 目录中。

注：在 nanoyunhu 目录中执行命令。

#### 安装依赖

```bash
pnpm i
```

#### 运行项目

```bash
pnpm start
# 或携带 .env
pnpm start:env
# 或使用 Node.js
node .
```

### 克隆项目

```bash
git clone https://github.com/TASA-Ed/nanoyunhu.git && cd nanoyunhu
```

#### 安装依赖

```bash
pnpm i
```

#### 构建项目

```bash
pnpm build
```

#### 运行项目

```bash
pnpm start
# 或携带 .env
pnpm start:env
# 或使用 node
node .
```

## 更新

**注**：我们对任何因为更新失败而导致的意外、数据丢失或其他不良后果**概不负责**——因此，请务必在开始前**备份**配置文件与使用数据！

在你的 `nanoyunhu` 目录中执行命令：

```bash
git fetch # 从 NanoYunhu 仓库中获取最新代码
git reset --hard v0.3.1-alpha # 将 "v0.3.1-alpha" 替换为你要升级到的版本
```

或使用主线分支（注：这些代码可能尚未正式发布）：

```bash
git fetch origin
git reset --hard origin/main
```

随后执行：

```bash
pnpm i # 更新依赖
pnpm build # 构建项目
```

大功告成！
