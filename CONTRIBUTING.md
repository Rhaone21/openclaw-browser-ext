# Contributing to OpenClaw Browser Extension

Thank you for your interest in contributing!

## Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/openclaw-browser-ext.git
cd openclaw-browser-ext

# Install dependencies
npm install

# Build the extension
npm run build

# Watch mode for development
npm run dev
```

## Project Structure

```
src/
├── background/     # Service worker scripts
├── content/        # Content scripts
├── popup/          # Popup UI
├── options/        # Options page
└── shared/         # Shared utilities and types

public/             # Static assets (manifest, HTML, icons)
dist/               # Build output (load this in Chrome)
```

## Code Style

- TypeScript strict mode enabled
- No `any` types
- Explicit return types on exported functions
- Comments for non-obvious logic

## Testing

Before submitting a PR:

1. Run type check: `npm run type-check`
2. Run linter: `npm run lint`
3. Test in Chrome: Load `dist/` as unpacked extension

## Submitting Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Submit a pull request

## Questions?

Open an issue or join the discussion on Discord.
