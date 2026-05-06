<p align="center">
	<a href="https://github.com/TASA-Ed/nanoyunhu" target="_blank" rel="noopener noreferrer">
		<img src="https://socialify.git.ci/TASA-Ed/nanoyunhu/image?custom_description=NanoYunHu%2C+Headless+YunHu.&description=1&font=Inter&forks=1&issues=1&language=1&logo=https%3A%2F%2Fwww.tasaed.top%2Fblog%2Fassets%2Flogos%2FT832.png&name=1&owner=1&pattern=Plus&pulls=1&stargazers=1&theme=Auto" alt="nanoyunhu" width="640" height="320" />
	</a>
</p>

<p align="center">
<a href="https://github.com/TASA-Ed/nanoyunhu/releases"><img alt="GitHub release" src="https://img.shields.io/github/v/release/TASA-Ed/nanoyunhu.svg?style=flat-square&include_prereleases"/></a>
</p>

[中文](README.zh.md)

## Use SEA Version

> Choose one of the two options: [Use Node Version](#use-node-version)

You can download nano-ubuntu-latest (Linux version) or nano-windows-latest (Windows version) from [Releases](https://github.com/TASA-Ed/nanoyunhu/releases) or [Actions](https://github.com/TASA-Ed/nanoyunhu/actions).

Then download and unzip the binary file, and you can run it right away!

Note: This may not be compatible with your system. If it fails to start, please [Use Node Version](#use-node-version).

## Use Node Version

> Choose one of the two options: [Use SEA version](#use-sea-version)

### Install Node.js

See [https://nodejs.org/zh-cn/download](https://nodejs.org/zh-cn/download).

#### Termux

```bash
pkg install nodejs-lts

corepack enable pnpm
```

### Download the release

> Choose one of the two options: [Clone Project](#clone-project)

Go to the [Release](https://github.com/TASA-Ed/nanoyunhu/releases) page to download the latest version.

Then extract it into the nanoyunhu directory.

Note: Run the command from within the nanoyunhu directory.

#### Install dependencies

```bash
pnpm i
```

#### Run project

```bash
pnpm start
# or include the .env file
pnpm start:env
# or use Node.js
node .
```

### Clone Project

```bash
git clone https://github.com/TASA-Ed/nanoyunhu.git && cd nanoyunhu
```

#### Install dependencies

```bash
pnpm i
```

#### Build project

```bash
pnpm build
```

#### Run project

```bash
pnpm start
# or include the .env file
pnpm start:env
# or use Node.js
node .
```

## Upgrade

**Note**: We **assume no responsibility** for any accidents, data loss, or other adverse consequences resulting from a failed update—therefore, please be sure to **back up** your configuration files and user data before proceeding!

### SEA Version

Simply download and replace the binary files directly from [Releases](https://github.com/TASA-Ed/nanoyunhu/releases) or [Actions](https://github.com/TASA-Ed/nanoyunhu/actions).

### Node Version

Run the following command in your `nanoyunhu` directory:

```bash
git fetch # Get the latest code from the NanoYunhu repository
git reset --hard v0.3.1-alpha # Replace "v0.3.1-alpha" with the version you want to upgrade to
```

Or use the mainline branches (Note: This code may not have been officially released yet):

```bash
git fetch origin
git reset --hard origin/main
```

Then execute:

```bash
pnpm i # Update dependencies
pnpm build # Build project
```

All done!

## Contact

- YunhuChat Discussion Group：[503991586](https://yhfx.jwznb.com/share?key=5ofcXfZ6w6BO&ts=1778083561)
