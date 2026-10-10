# Gtube

Gtube is a desktop application built with React, TypeScript, Vite, and
[Tauri](https://tauri.app/). The application provides a native desktop
window while using a web-based React frontend.

## Requirements

Install the following tools before building or running Gtube:

- [Node.js](https://nodejs.org/) 20 or later (the LTS release is recommended)
- [npm](https://www.npmjs.com/), included with Node.js
- [Rust](https://www.rust-lang.org/tools/install), installed with `rustup`
- [Git](https://git-scm.com/)

Tauri also requires platform-specific system dependencies:

### Windows

Install:

- Microsoft Visual Studio Build Tools with the **Desktop development with C++**
  workload
- [Microsoft Edge WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)

### macOS

Install Xcode Command Line Tools:

```bash
xcode-select --install
```

### Ubuntu/Debian Linux

Install the Tauri build dependencies and the media tools used by Gtube:

```bash
sudo apt update
sudo apt install \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libxdo-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libwebkit2gtk-4.1-dev \
  ffmpeg \
  yt-dlp \
  mpv
```

`ffprobe` is normally installed with `ffmpeg`. Verify the required commands are
available:

```bash
ffmpeg -version
ffprobe -version
yt-dlp --version
mpv --version
```

## Getting started

Clone the repository and install its JavaScript dependencies:

```bash
git clone https://github.com/gvaa404/Gtube.git
cd Gtube
npm install
```

## Development

Start the Tauri desktop application in development mode:

```bash
npm run tauri:dev
```

This starts the Vite development server and opens the native Gtube window.
Changes to the React or TypeScript source are reflected through Vite's hot
module replacement.

To run only the frontend in a browser:

```bash
npm run dev
```

Open the URL printed in the terminal, usually
[`http://localhost:5173`](http://localhost:5173).

## Production build

Build the frontend and create a distributable Tauri package:

```bash
npm run tauri:build
```

Build artifacts are written to:

```text
src-tauri/target/release/bundle/
```

The current Tauri configuration produces Linux packages for:

- `appimage/` - portable AppImage packages
- `deb/` - Debian/Ubuntu packages

Install a generated Debian package with:

```bash
sudo apt install ./src-tauri/target/release/bundle/deb/*.deb
```

The generated Linux package declares `ffmpeg`, `yt-dlp`, `mpv`, and `ffprobe`
as runtime dependencies. If you build or run Gtube outside a Debian-based
distribution, install those tools using your distribution's package manager.

## Available commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite frontend development server |
| `npm run build` | Type-check and build the frontend |
| `npm run preview` | Preview the production frontend build |
| `npm run tauri:dev` | Run the desktop app in development mode |
| `npm run tauri:build` | Build installable Tauri packages |
| `npm run lint` | Run ESLint |
| `npm run check` | Run ESLint and Rust tests |

## Project structure

```text
src/                 React and TypeScript frontend
public/              Static frontend assets
src-tauri/           Tauri and Rust desktop application
src-tauri/icons/     Application icons
src-tauri/target/    Rust and Tauri build output (generated)
dist/                Frontend build output (generated)
```

## Troubleshooting

### `npm` or `node` is not recognized

Install Node.js from [nodejs.org](https://nodejs.org/) and restart your
terminal. Confirm the installation with:

```bash
node --version
npm --version
```

### `cargo` or `rustc` is not recognized

Install Rust with `rustup` from
[rustup.rs](https://www.rust-lang.org/tools/install), then restart your
terminal:

```bash
rustc --version
cargo --version
```

### The desktop build cannot find media tools

Install `ffmpeg`, `ffprobe`, `yt-dlp`, and `mpv`, then verify that each command
works from the same terminal used to launch Gtube. On Linux, these tools are
also required when installing the generated package.

### A clean rebuild is needed

Remove generated dependencies and build output, then reinstall:

```bash
rm -rf node_modules dist src-tauri/target
npm install
npm run tauri:build
```

On Windows, remove `node_modules`, `dist`, and `src-tauri/target` using File
Explorer or PowerShell instead of the `rm` command.

## Technology

- React
- TypeScript
- Vite
- Tauri
- Rust
