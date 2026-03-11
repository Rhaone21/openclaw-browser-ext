# OpenClaw Browser Extension

Browser extension that enables OpenClaw AI agents to control and automate web browsing via Chrome DevTools Protocol (CDP).

## Features

- **Tab Attachment**: Attach OpenClaw to any browser tab with one click
- **CDP Relay**: Secure WebSocket relay to OpenClaw Gateway
- **Auto-attach Mode**: Automatically attach to new tabs (configurable)
- **Session Persistence**: Remember attached tabs across browser restarts
- **Element Picker**: Select elements on page and send to OpenClaw

## Installation

### From Source (Development)

```bash
git clone https://github.com/yourusername/openclaw-browser-ext.git
cd openclaw-browser-ext
npm install
npm run build
```

1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` folder

### Configuration

1. Click extension icon → Options
2. Set your OpenClaw Gateway token
3. Configure relay port (default: 18792)

## Development

```bash
# Install dependencies
npm install

# Build once
npm run build

# Watch mode (auto-rebuild on changes)
npm run dev

# Type check
npm run type-check

# Lint
npm run lint
```

## Architecture

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│  Chrome Ext     │ ◄────────────────► │  OpenClaw        │
│  (content +     │     CDP Relay      │  Gateway         │
│   background)   │                    │                  │
└────────┬────────┘                    └──────────────────┘
         │
         ▼
┌─────────────────┐
│  User's Page    │
│  (controlled)   │
└─────────────────┘
```

## License

MIT
