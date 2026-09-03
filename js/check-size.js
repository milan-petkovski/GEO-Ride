import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist/assets');
if (!fs.existsSync(distDir)) {
    console.error('Dist directory does not exist. Run `npm run build` first.');
    process.exit(1);
}

const files = fs.readdirSync(distDir);
let totalJsSize = 0;
let totalCssSize = 0;

files.forEach((file) => {
    const filePath = path.join(distDir, file);
    const stat = fs.statSync(filePath);
    if (file.endsWith('.js')) totalJsSize += stat.size;
    if (file.endsWith('.css')) totalCssSize += stat.size;
});

const maxJsKb = 180;
const maxTotalCssKb = 120;
const maxSingleCssKb = 60;

const jsKb = (totalJsSize / 1024).toFixed(2);
const cssKb = (totalCssSize / 1024).toFixed(2);

console.log(`Bundle Size Check: Total JS = ${jsKb} KB (Limit ${maxJsKb} KB), Total CSS = ${cssKb} KB (Limit ${maxTotalCssKb} KB)`);

let failed = false;
files.forEach((file) => {
    if (file.endsWith('.css')) {
        const sizeKb = fs.statSync(path.join(distDir, file)).size / 1024;
        console.log(`  CSS file: ${file} = ${sizeKb.toFixed(2)} KB (Per-page limit ${maxSingleCssKb} KB)`);
        if (sizeKb > maxSingleCssKb) failed = true;
    }
});

if (totalJsSize > maxJsKb * 1024 || totalCssSize > maxTotalCssKb * 1024 || failed) {
    console.error('Bundle size limit exceeded!');
    process.exit(1);
} else {
    console.log('Bundle size limits passed cleanly!');
}
