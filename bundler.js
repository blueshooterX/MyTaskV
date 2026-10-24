/**
 * MyTask
 * https://github.com/blueshooterX/MyTask
 * 
 * Copyright (c) 2026 blueshooterX
 * Licensed under the MIT License.
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, 'dist');
const SERVER_FILES = ['AppConfig.js.sample', 'RichTextLib.js', 'TaskService.js', 'Code.js'];
const CLIENT_MAIN = 'index.html';

/**
 * Consolidate server-side JS files into one Code.gs
 */
function bundleServer() {
    console.log('[Info] Bundling server-side files...');
    let combined = '// Combined Google Apps Script Logic\n\n';
    let fileCount = 0;

    SERVER_FILES.forEach(file => {
        const filePath = path.join(__dirname, file);
        try {
            if (fs.existsSync(filePath)) {
                console.log(`  |- Adding: ${file}`);
                combined += `\n/* --- START ${file} --- */\n`;
                let content = fs.readFileSync(filePath, 'utf8');

                // Remove include function from Code.js (not needed in bundled version)
                if (file === 'Code.js') {
                    content = content.replace(/function include\([^)]*\)\s*\{[^}]*\}/g, '');
                }

                combined += content;
                combined += `\n/* --- END ${file} --- */\n`;
                fileCount++;
            } else {
                console.warn(`  [Warning] File not found, skipping: ${file}`);
            }
        } catch (err) {
            console.error(`  [Error] Failed to read ${file}:`, err.message);
            throw err; // Re-throw to abort bundling if a critical file fails
        }
    });

    const outPath = path.join(DIST_DIR, 'Code.gs');
    try {
        fs.writeFileSync(outPath, combined);
        console.log(`[Success] Server bundle created: ${outPath} (${fileCount} files merged)`);
    } catch (err) {
        console.error(`[Error] Failed to write server bundle:`, err.message);
        throw err;
    }
}

/**
 * Consolidate client-side HTML files into one index.html
 */
function bundleClient() {
    console.log('[Info] Bundling client-side files...');
    const mainPath = path.join(__dirname, CLIENT_MAIN);

    if (!fs.existsSync(mainPath)) {
        throw new Error(`Main client file not found: ${CLIENT_MAIN}`);
    }

    let mainHtml;
    try {
        mainHtml = fs.readFileSync(mainPath, 'utf8');
    } catch (err) {
        console.error(`[Error] Failed to read ${CLIENT_MAIN}:`, err.message);
        throw err;
    }

    // Regex to find <?!= include('filename'); ?> or <?!= include('filename') ?>
    const includeRegex = /<\?!(=?)\s*include\(['"]([^'"]+)['"]\);?\s*\?>/g;
    let inlineCount = 0;

    let bundledHtml = mainHtml.replace(includeRegex, (match, equals, filename) => {
        const filePath = path.join(__dirname, `${filename}.html`);
        try {
            if (fs.existsSync(filePath)) {
                console.log(`  |- Inlining: ${filename}.html`);
                inlineCount++;
                return `\n<!-- --- START ${filename}.html --- -->\n` +
                    fs.readFileSync(filePath, 'utf8') +
                    `\n<!-- --- END ${filename}.html --- -->\n`;
            } else {
                console.warn(`  [Warning] Include file not found, leaving intact: ${filename}.html`);
                return match;
            }
        } catch (err) {
            console.error(`  [Error] Failed to inline ${filename}.html:`, err.message);
            return match; // Keep original match on error to avoid breaking HTML completely, though throwing might be safer.
        }
    });

    const outPath = path.join(DIST_DIR, 'index.html');
    try {
        fs.writeFileSync(outPath, bundledHtml);
        console.log(`[Success] Client bundle created: ${outPath} (${inlineCount} files inlined)`);
    } catch (err) {
        console.error(`[Error] Failed to write client bundle:`, err.message);
        throw err;
    }
}

// Ensure dist directory exists
try {
    if (!fs.existsSync(DIST_DIR)) {
        console.log(`[Info] Creating output directory: ${DIST_DIR}`);
        fs.mkdirSync(DIST_DIR);
    }
} catch (err) {
    console.error(`[Error] Failed to create output directory:`, err.message);
    process.exit(1);
}

// Execute Bundling
console.log('--- Starting Build Process ---');
try {
    bundleServer();
    bundleClient();
    console.log('--- Build Process Completed Successfully ---');
    console.log('\nDeployment Instructions:');
    console.log('1. Open your Google Apps Script editor.');
    console.log('2. Replace the contents of Code.gs with the generated /dist/Code.gs');
    console.log('3. Replace the contents of index.html with the generated /dist/index.html');
} catch (err) {
    console.error('\n--- Build Process Failed ---');
    console.error('An error occurred during bundling that could not be recovered from.');
    process.exit(1);
}
