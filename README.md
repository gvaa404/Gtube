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

### Linux

Linux is supported on distributions with GTK/WebKitGTK and the Tauri system
dependencies available. Ubuntu 22.04/24.04, Debian, Linux Mint, Fedora, and
Arch Linux are suitable for development. The commands below install the
dependencies for common distributions.

#### Ubuntu, Debian, and Linux Mint

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

On older Ubuntu/Debian releases where `libwebkit2gtk-4.1-dev` is unavailable,
install the WebKitGTK development package provided by that release instead,
for example `libwebkit2gtk-4.0-dev`.

#### Fedora

```bash
sudo dnf group install "Development Tools"
sudo dnf install \
  curl \
  wget \
  file \
  openssl-devel \
  libX11-devel \
  libxdo-devel \
  libappindicator-gtk3-devel \
  librsvg2-devel \
  gtk3-devel \
  webkit2gtk4.1-devel \
  ffmpeg \
  yt-dlp \
  mpv
```

The `ffmpeg` package may require the RPM Fusion repositories on Fedora. Follow
the [RPM Fusion setup instructions](https://rpmfusion.org/Configuration) if
your package manager cannot find it.

#### Arch Linux and Manjaro

```bash
sudo pacman -S --needed \
  base-devel \
  curl \
  wget \
  file \
  openssl \
  libxdo \
  libappindicator-gtk3 \
  librsvg \
  webkit2gtk-4.1 \
  ffmpeg \
  yt-dlp \
  mpv
```

#### Verify Linux dependencies

After installing the packages, verify that the media tools are available:

```bash
ffmpeg -version
ffprobe -version
yt-dlp --version
mpv --version
```

Then continue with the project setup:

```bash
git clone https://github.com/gvaa404/Gtube.git
cd Gtube
npm install
npm run tauri:dev
```

To build a Linux installer:

```bash
npm run tauri:build
```

The resulting packages are placed in
`src-tauri/target/release/bundle/`. Debian-based systems can install the
`.deb` package with:

```bash
sudo apt install ./src-tauri/target/release/bundle/deb/*.deb
```

An AppImage does not need to be installed. Make it executable and launch it:

```bash
chmod +x src-tauri/target/release/bundle/appimage/*.AppImage
./src-tauri/target/release/bundle/appimage/*.AppImage
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

The generated Linux package declares `ffmpeg`, `yt-dlp`, and `mpv` as runtime
dependencies. The `ffprobe` executable is provided by the `ffmpeg` package and
is checked by Gtube at runtime; it is intentionally not listed as a separate
Debian dependency. If you build or run Gtube outside a Debian-based
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

Install `ffmpeg` (which provides `ffprobe`), `yt-dlp`, and `mpv`, then verify
that each command works from the same terminal used to launch Gtube. On Linux,
these tools are also required when installing the generated package.

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
