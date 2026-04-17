import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '..', 'src', 'pages', 'home', 'HomePage.jsx');

function replaceSafely(content, searchRegex, replaceWith) {
    return content.replace(searchRegex, replaceWith);
}

function patchFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Backgrounds
    content = replaceSafely(content, /\bbg-white\b(?!\s*dark:bg-(?:zinc|slate)-\d+)/g, 'bg-white dark:bg-zinc-900');
    content = replaceSafely(content, /\bbg-zinc-50\b(?!\/|\s*dark:bg)/g, 'bg-zinc-50 dark:bg-zinc-800/50');
    content = replaceSafely(content, /\bbg-zinc-50\/([0-9]+)\b(?!\s*dark:bg)/g, 'bg-zinc-50/$1 dark:bg-zinc-800/50');
    content = replaceSafely(content, /\bbg-zinc-100\b(?!\/|\s*dark:bg)/g, 'bg-zinc-100 dark:bg-zinc-800');
    content = replaceSafely(content, /\bbg-zinc-100\/([0-9]+)\b(?!\s*dark:bg)/g, 'bg-zinc-100/$1 dark:bg-zinc-800/80');

    // Text Colors
    content = replaceSafely(content, /\btext-zinc-900\b(?!\s*dark:text)/g, 'text-zinc-900 dark:text-zinc-100');
    content = replaceSafely(content, /\btext-zinc-800\b(?!\s*dark:text)/g, 'text-zinc-800 dark:text-zinc-200');
    content = replaceSafely(content, /\btext-zinc-700\b(?!\s*dark:text)/g, 'text-zinc-700 dark:text-zinc-300');
    content = replaceSafely(content, /\btext-zinc-600\b(?!\s*dark:text)/g, 'text-zinc-600 dark:text-zinc-400');
    content = replaceSafely(content, /\btext-zinc-500\b(?!\s*dark:text)/g, 'text-zinc-500 dark:text-zinc-400');

    // Borders & Rings
    content = replaceSafely(content, /\bborder-zinc-200\b(?!\/|\s*dark:border)/g, 'border-zinc-200 dark:border-zinc-800');
    content = replaceSafely(content, /\bborder-zinc-200\/([0-9]+)\b(?!\s*dark:border)/g, 'border-zinc-200/$1 dark:border-zinc-800/80');
    content = replaceSafely(content, /\bborder-zinc-100\b(?!\s*dark:border)/g, 'border-zinc-100 dark:border-zinc-800/50');
    content = replaceSafely(content, /ring-zinc-950\/\[0\.06\](?!\s*dark:ring)/g, 'ring-zinc-950/[0.06] dark:ring-zinc-800');
    content = replaceSafely(content, /ring-zinc-200\/80(?!\s*dark:ring)/g, 'ring-zinc-200/80 dark:ring-zinc-700');
    content = replaceSafely(content, /\bdivide-zinc-100\b(?!\s*dark:divide)/g, 'divide-zinc-100 dark:divide-zinc-800');

    // Pseudo fixing
    const regex = /\b(hover|focus|active|disabled):([a-z]+-(?:white|zinc|slate)(?:-[0-9]+)?(?:\/[0-9]+)?)\s+dark:([a-z]+-(?:zinc|slate)-[0-9]+(?:\/[0-9]+)?)\b/g;
    content = content.replace(regex, (match, pseudo, lightClass, darkClass) => {
        return `${pseudo}:${lightClass} dark:${pseudo}:${darkClass}`;
    });

    fs.writeFileSync(filePath, content, 'utf8');
}

patchFile(filePath);
