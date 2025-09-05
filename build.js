#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { gzipSize } from 'gzip-size';
import { build, context } from 'esbuild';

// Parse command line arguments
const args = process.argv.slice(2);
const isWatch = args.includes('--watch');
const isProduction = process.env.NODE_ENV === 'production';

// Bundle size limits (in bytes)
const BUNDLE_SIZE_LIMITS = {
  gzipped: 400 * 1024, // 400KB
  raw: 1200 * 1024     // 1.2MB
};

/**
 * Generate single HTML file with inline JavaScript and Blob Worker
 */
function generateHTML(jsContent, workerContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Resuum - AI-Powered Resume Optimization</title>
    <meta name="description" content="Transform resume customization from a 30-minute manual process to a 2-minute AI-assisted workflow">
    
    
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8fafc;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 2rem;
        }
        
        .header h1 {
            color: #1e293b;
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
        }
        
        .header p {
            color: #64748b;
            font-size: 1.1rem;
        }
        
        .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 200px;
            font-size: 1.1rem;
            color: #64748b;
        }
        
        .error {
            background-color: #fef2f2;
            border: 1px solid #fca5a5;
            color: #dc2626;
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>Resuum</h1>
            <p>AI-Powered Resume Optimization</p>
        </header>
        
        <main id="app">
            <div class="loading">
                Loading application...
            </div>
        </main>
    </div>

    <script>
        // Create worker from inline code
        const workerBlob = new Blob([\`${workerContent.replace(/`/g, '\\`')}\`], { type: 'application/javascript' });
        window.WORKER_URL = URL.createObjectURL(workerBlob);
        
        // Main application code
        ${jsContent}
    </script>
</body>
</html>`;
}

/**
 * Calculate and report bundle size
 */
async function reportBundleSize(filePath) {
  try {
    const content = readFileSync(filePath);
    const rawSize = content.length;
    const gzippedSize = await gzipSize(content);
    
    console.log(`📦 Bundle size:`);
    console.log(`   Raw: ${(rawSize / 1024).toFixed(1)}KB`);
    console.log(`   Gzipped: ${(gzippedSize / 1024).toFixed(1)}KB`);
    
    // Check size limits
    if (gzippedSize > BUNDLE_SIZE_LIMITS.gzipped) {
      console.warn(`⚠️  WARNING: Gzipped bundle size (${(gzippedSize / 1024).toFixed(1)}KB) exceeds limit (${(BUNDLE_SIZE_LIMITS.gzipped / 1024).toFixed(1)}KB)`);
    }
    
    if (rawSize > BUNDLE_SIZE_LIMITS.raw) {
      console.warn(`⚠️  WARNING: Raw bundle size (${(rawSize / 1024).toFixed(1)}KB) exceeds limit (${(BUNDLE_SIZE_LIMITS.raw / 1024).toFixed(1)}KB)`);
    }
    
    return { rawSize, gzippedSize };
  } catch (error) {
    console.error(`Error calculating bundle size:`, error.message);
    return null;
  }
}

/**
 * Main build function
 */
async function buildApp() {
  console.log(`🚀 Building Resuum (single-file mode)`);
  
  // Ensure docs directory exists
  mkdirSync('docs', { recursive: true });
  
  try {
    // Build main application
    const mainResult = await build({
      entryPoints: ['src/main.ts'],
      format: 'iife',
      bundle: true,
      minify: isProduction,
      sourcemap: !isProduction ? 'inline' : false,
      target: ['chrome91', 'firefox90', 'safari14'],
      define: {
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development')
      },
      write: false
    });
    
    // Build worker
    const workerResult = await build({
      entryPoints: ['src/workers/recommendation.worker.ts'],
      format: 'iife',
      bundle: true,
      minify: isProduction,
      target: ['chrome91', 'firefox90', 'safari14'],
      write: false
    });
    
    // Combine into single HTML file
    const jsContent = mainResult.outputFiles[0].text;
    const workerContent = workerResult.outputFiles[0].text;
    const html = generateHTML(jsContent, workerContent);
    
    // Write output
    const outputPath = 'docs/index.html';
    writeFileSync(outputPath, html);
    
    // Report bundle size
    await reportBundleSize(outputPath);
    
    if (isWatch) {
      console.log(`👀 Watching for changes...`);
    } else {
      console.log(`✅ Build completed successfully`);
    }
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    
    if (!isWatch) {
      process.exit(1);
    }
  }
}

// Handle watch mode
if (isWatch) {
    (async () => {
      console.log('👀 Starting watch mode...');
      
      const rebuildApp = async () => {
        try {
          await buildApp();
        } catch (error) {
          console.error('❌ Rebuild failed:', error.message);
        }
      };
      
      // Initial build
      await rebuildApp();
      
      // Watch for changes using filesystem
      const { watch } = await import('fs');
      watch('src', { recursive: true }, (eventType, filename) => {
        if (filename && filename.endsWith('.ts')) {
          console.log(`🔄 File changed: ${filename}, rebuilding...`);
          rebuildApp();
        }
      });
      
      // Keep process alive
      process.on('SIGINT', () => {
        console.log('\n👋 Stopping watch mode...');
        process.exit(0);
      });
    })();
  } else {
    buildApp().catch(console.error);
  }