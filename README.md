# Resuum

AI-powered resume optimization tool that transforms resume customization from a 30-minute manual process to a 2-minute AI-assisted workflow.

## Quick Start

```bash
npm install
npm run dev         # start with watch
# or:
npm run build && npm run preview
```

## Architecture

Resuum is built as a **single HTML file** with:
- **Inline JavaScript** - All application code embedded
- **Blob Worker** - Web Worker created from inline code
- **Local-first** - IndexedDB storage, no server required
- **BYO OpenAI API key** - Your key stays in your browser

## Development

```bash
# Build for production
npm run build

# Start development with watch mode
npm run dev

# Type checking
npm run type-check

# Preview built application
npm run preview
```

## Deployment

The build outputs a single `docs/index.html` file that can be:
- Hosted on any static server
- Deployed to GitHub Pages
- Downloaded and run locally
- Shared as a single file

## Bundle Size Monitoring

The build system automatically monitors bundle size:
- **Warning threshold**: 400KB gzipped
- **Target**: Optimized for fast loading

## Browser Compatibility

- Chrome/Edge 91+
- Firefox 90+  
- Safari 14+

## Security

- **Content Security Policy** configured for single-file deployment
- **XSS protection** throughout UI rendering
- **API key storage** local to browser only