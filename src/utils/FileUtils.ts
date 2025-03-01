import * as vscode from 'vscode';
import * as path from 'path';
import { GitignoreUtils } from './GitignoreUtils';

export interface FileInfo {
    path: string;
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

    constructor() {
        this.gitignoreUtils = new GitignoreUtils();
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
    private async isBinaryFile(uri: vscode.Uri): Promise<boolean> {
        try {
            // First check if it's a known text file extension
            const config = this.getConfig();
            const ext = path.extname(uri.fsPath).slice(1).toLowerCase();
            
            if (config.textExtensions.has(ext)) {
                return false;
            }

            // Check for obvious binary extensions
            if (config.binaryExtensions.has(ext)) {
                return true;
            }

            // Read the file header
            const fileContent = await vscode.workspace.fs.readFile(uri);
            if (fileContent.length === 0) {
                return false;
            }

            // Check magic numbers
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
                const controlChars = fileContent.filter(byte => 
                    (byte < 32 && ![9, 10, 13].includes(byte)) || // Exclude TAB, LF, CR
                    (byte >= 0x7F && byte <= 0x9F)               // Extended ASCII control chars
                );
                const controlCharRatio = controlChars.length / fileContent.length;
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
        const document = await vscode.workspace.openTextDocument(uri);
        return document.getText();
    }

    /**
     * Read files from a directory
     */
    async readFilesInDirectory(uri: vscode.Uri, recursive: boolean): Promise<FileInfo[]> {
        const results: FileInfo[] = [];
        const useGitignore = vscode.workspace.getConfiguration('otakClipboard').get('useGitignore', true);
        
        try {
            await this.processDirectory(uri, recursive, results, useGitignore);
        } catch (error) {
            vscode.window.showErrorMessage(`Error reading directory: ${error}`);
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
        useGitignore: boolean
    ): Promise<void> {
        const entries = await vscode.workspace.fs.readDirectory(uri);

        // Record the directory itself
        results.push({
            path: uri.fsPath,
            isDirectory: true,
            isEmpty: entries.length === 0
        });

        for (const [name, type] of entries) {
            const fullPath = path.join(uri.fsPath, name);
            const fileUri = vscode.Uri.file(fullPath);

            // Check excluded directories
            const config = this.getConfig();
            if (type === vscode.FileType.Directory && config.excludeDirectories.has(name)) {
                continue;
            }

            // Process directories
            if (type === vscode.FileType.Directory) {
                if (recursive) {
                    await this.processDirectory(fileUri, recursive, results, useGitignore);
                } else {
                    // Record directory even in non-recursive mode
                    const dirEntries = await vscode.workspace.fs.readDirectory(fileUri);
                    results.push({
                        path: fullPath,
                        isDirectory: true,
                        isEmpty: dirEntries.length === 0
                    });
                }
                continue;
            }

            // Process files
            if (type === vscode.FileType.File) {
                // Check .gitignore
                if (useGitignore && await this.gitignoreUtils.isIgnored(fileUri)) {
                    continue;
                }

                const isBinary = await this.isBinaryFile(fileUri);
                if (isBinary) {
                    // For binary files, only record the path
                    results.push({
                        path: fullPath,
                        isBinary: true
                    });
                    continue;
                }

                try {
                    const content = await this.readFile(fileUri);
                    results.push({
                        path: fullPath,
                        content: content,
                        isBinary: false
                    });
                } catch (error) {
                    // Skip unreadable files
                    continue;
                }
            }
        }
    }
}