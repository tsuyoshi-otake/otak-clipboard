import fs from 'node:fs';
import path from 'node:path';

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function collectNlsKeys(value) {
    const serialized = JSON.stringify(value);
    const keys = new Set();
    const pattern = /%([^%]+)%/g;

    for (let match; (match = pattern.exec(serialized));) {
        keys.add(match[1]);
    }

    return [...keys].sort();
}

const repoRoot = process.cwd();
const packageJson = readJson(path.join(repoRoot, 'package.json'));
const keys = collectNlsKeys(packageJson);
const localesDir = path.join(repoRoot, 'src', 'i18n', 'locales');
const englishMessages = readJson(path.join(localesDir, 'en.json'));

const targets = [
    { locale: 'en', source: 'en.json', output: 'package.nls.json' },
    { locale: 'ja', source: 'ja.json', output: 'package.nls.ja.json' },
    { locale: 'ko', source: 'ko.json', output: 'package.nls.ko.json' },
    { locale: 'vi', source: 'vi.json', output: 'package.nls.vi.json' },
    { locale: 'zh-cn', source: 'zh-cn.json', output: 'package.nls.zh-cn.json' },
    { locale: 'zh-tw', source: 'zh-tw.json', output: 'package.nls.zh-tw.json' }
];

for (const target of targets) {
    const messages = readJson(path.join(localesDir, target.source));
    const output = {};

    for (const key of keys) {
        const value = messages[key] ?? englishMessages[key];
        if (typeof value !== 'string') {
            throw new Error(`Missing package NLS key '${key}' for ${target.locale}`);
        }
        output[key] = value;
    }

    writeJson(path.join(repoRoot, target.output), output);
}
