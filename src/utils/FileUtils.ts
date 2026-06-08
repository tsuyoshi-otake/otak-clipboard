import * as vscode from 'vscode';
import * as path from 'path';
import { GitignoreUtils } from './GitignoreUtils';
import { ContentBudget, LimitExceededError } from './LimitChecker';
import { I18nManager } from '../i18n/I18nManager';

export interface FileInfo {
    path: string;
    uri?: vscode.Uri;
    content?: string;
    isDirectory?: boolean;
    isEmpty?: boolean;
    isBinary?: boolean;
}

// Magic number patterns for binary files
const MAGIC_NUMBERS = [
    { bytes: [0xFF, 0xD8, 0xFF], extension: 'jpg/jpeg' },          // JPEG
    { bytes: [0x89, 0x50, 0x4E, 0x47], extension: 'png' },         // PNG
    { bytes: [0x47, 0x49, 0x46], extension: 'gif' },               // GIF
    { bytes: [0x50, 0x4B, 0x03, 0x04], extension: 'zip/jar' },     // ZIP/JAR
    { bytes: [0x25, 0x50, 0x44, 0x46], extension: 'pdf' },         // PDF
    { bytes: [0x7F, 0x45, 0x4C, 0x46], extension: 'elf' },         // ELF
    { bytes: [0xD0, 0xCF, 0x11, 0xE0], extension: 'doc/xls' },     // MS Office
    { bytes: [0x50, 0x4B, 0x03, 0x04], extension: 'docx/xlsx' }    // MS Office XML
];

export class FileUtils {
    private readonly gitignoreUtils: GitignoreUtils;

    constructor(gitignoreUtils: GitignoreUtils = new GitignoreUtils()) {
        this.gitignoreUtils = gitignoreUtils;
    }

    /**
     * Get configuration values
     */
    private getConfig() {
        const config = vscode.workspace.getConfiguration('otakClipboard');
        return {
            excludeDirectories: new Set(config.get<string[]>('excludeDirectories', [])),
            textExtensions: new Set(config.get<string[]>('knownTextExtensions', [])),
            binaryExtensions: new Set(config.get<string[]>('knownBinaryExtensions', [])),
            binaryDetectionRules: config.get<{
                nullByteCheck: boolean;
                controlCharRatio: number;
                controlCharCheck: boolean;
            }>('binaryDetectionRules', {
                nullByteCheck: true,
                controlCharRatio: 0.3,
                controlCharCheck: true
            })
        };
    }

    /**
     * Check if a file is binary
     */
    private isBinaryContent(uri: vscode.Uri, fileContent: Uint8Array): boolean {
        try {
            const config = this.getConfig();
            const ext = path.extname(uri.fsPath).slice(1).toLowerCase();

            if (config.textExtensions.has(ext)) {
                return false;
            }

            if (config.binaryExtensions.has(ext)) {
                return true;
            }

            if (fileContent.length === 0) {
                return false;
            }

            for (const magic of MAGIC_NUMBERS) {
                if (fileContent.length >= magic.bytes.length) {
                    let match = true;
                    for (let i = 0; i < magic.bytes.length; i++) {
                        if (fileContent[i] !== magic.bytes[i]) {
                            match = false;
                            break;
                        }
                    }
                    if (match) {
                        return true;
                    }
                }
            }

            const rules = config.binaryDetectionRules;
            
            if (rules.nullByteCheck) {
                const hasNullByte = fileContent.includes(0);
                if (hasNullByte) {
                    return true;
                }
            }

            if (rules.controlCharCheck) {
                let controlChars = 0;
                for (const byte of fileContent) {
                    if ((byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) ||
                        (byte >= 0x7F && byte <= 0x9F)) {
                        controlChars++;
                    }
                }

                const controlCharRatio = controlChars / fileContent.length;
                if (controlCharRatio > rules.controlCharRatio) {
                    return true;
                }
            }

            return false;
        } catch (error) {
            // If there's an error, treat as binary for safety
            return true;
        }
    }

    /**
     * Read the contents of a single file
     */
    async readFile(uri: vscode.Uri): Promise<string> {
        const file = await this.readSingleFile(uri);
        return file.content ?? '';
    }

    async readSingleFile(uri: vscode.Uri, budget?: ContentBudget): Promise<FileInfo> {
        budget?.addFile();

        const bytes = await this.readFileBytes(uri, budget);
        const isBinary = this.isBinaryContent(uri, bytes);

        if (isBinary) {
            return {
                path: uri.fsPath,
                uri,
                isBinary: true
            };
        }

        const content = new TextDecoder().decode(bytes);
        budget?.addContent(content);

        return {
            path: uri.fsPath,
            uri,
            content,
            isBinary: false
        };
    }

    /**
     * Read files from a directory
     */
    async readFilesInDirectory(uri: vscode.Uri, recursive: boolean, budget?: ContentBudget): Promise<FileInfo[]> {
        const results: FileInfo[] = [];
        const useGitignore = vscode.workspace.getConfiguration('otakClipboard').get('useGitignore', true);

        try {
            await this.processDirectory(uri, recursive, results, useGitignore, budget);
        } catch (error) {
            if (error instanceof LimitExceededError) {
                throw error;
            }
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(
                I18nManager.getInstance().t('error.readingDirectory', { message })
            );
        }

        return results;
    }

    /**
     * Process directory recursively
     */
    private async processDirectory(
        uri: vscode.Uri,
        recursive: boolean,
        results: FileInfo[],
        useGitignore: boolean,
        budget?: ContentBudget
    ): Promise<void> {
        const entries = await vscode.workspace.fs.readDirectory(uri);

        budget?.addFile();
        results.push({
            path: uri.fsPath,
            uri,
            isDirectory: true,
            isEmpty: entries.length === 0
        });

        const config = this.getConfig();
        for (const [name, type] of entries) {
            const fileUri = vscode.Uri.joinPath(uri, name);

            if (type === vscode.FileType.Directory && config.excludeDirectories.has(name)) {
                continue;
            }

            if (type === vscode.FileType.Directory) {
                if (recursive) {
                    await this.processDirectory(fileUri, recursive, results, useGitignore, budget);
                } else {
                    const dirEntries = await vscode.workspace.fs.readDirectory(fileUri);
                    budget?.addFile();
                    results.push({
                        path: fileUri.fsPath,
                        uri: fileUri,
                        isDirectory: true,
                        isEmpty: dirEntries.length === 0
                    });
                }
                continue;
            }

            if (type === vscode.FileType.File) {
                if (useGitignore && await this.gitignoreUtils.isIgnored(fileUri)) {
                    continue;
                }

                try {
                    results.push(await this.readSingleFile(fileUri, budget));
                } catch (error) {
                    if (error instanceof LimitExceededError) {
                        throw error;
                    }
                    continue;
                }
            }
        }
    }

    private async readFileBytes(uri: vscode.Uri, budget?: ContentBudget): Promise<Uint8Array> {
        const stat = await vscode.workspace.fs.stat(uri);
        const maxSafeBytes = (budget?.limits.maxCharacters ?? 400000) * 4;

        if (stat.size > maxSafeBytes) {
            throw new LimitExceededError('characters', stat.size, budget?.limits.maxCharacters ?? 400000);
        }

        return vscode.workspace.fs.readFile(uri);
    }
}
