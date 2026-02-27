# NanoYunHu 无头云湖

无头云湖。

## 安装 nodejs

参考 [https://nodejs.org/zh-cn/download](https://nodejs.org/zh-cn/download) 。

### Termux

```bash
pkg install nodejs-lts

corepack enable pnpm
```

## 克隆项目

```bash
git clone https://github.com/TASA-Ed/nanoyunhu.git && cd nanoyunhu
```

## 安装依赖

```bash
pnpm i
```

## 构建项目

```bash
pnpm build
```

## 运行项目

```bash
pnpm start
# 或携带 env
pnpm start:env
```

## 开发项目

```bash
pnpm dev
```

## 类型检查

```bash
pnpm typecheck
```
