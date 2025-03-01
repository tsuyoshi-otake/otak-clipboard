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

export class FileUtils {
    private readonly gitignoreUtils: GitignoreUtils;
    private readonly excludeDirectories = new Set([
        '.git',              // Git directory
        'node_modules',      // Node.js dependencies
        'out',              // Build output
    ]);

    // Extensions that should always be treated as text files
    private readonly textExtensions = new Set([
        'txt', 'md', 'markdown',           // Common text formats
        'json', 'yaml', 'yml', 'toml',     // Config files
        'js', 'ts', 'jsx', 'tsx',          // JavaScript/TypeScript
        'py', 'rb', 'php', 'java',         // Other programming languages
        'css', 'scss', 'less',             // Stylesheets
        'html', 'htm', 'xml',              // Markup
        'sh', 'bash', 'zsh',               // Shell scripts
        'ini', 'conf', 'cfg',              // Config files
        'log',                             // Log files
        'csv', 'tsv',                      // Data files
        'gitignore', 'env',                // Other config files
    ]);

    // Magic number patterns for binary files
    private readonly MAGIC_NUMBERS = [
        { bytes: [0xFF, 0xD8, 0xFF], extension: 'jpg/jpeg' },          // JPEG
        { bytes: [0x89, 0x50, 0x4E, 0x47], extension: 'png' },         // PNG
        { bytes: [0x47, 0x49, 0x46], extension: 'gif' },               // GIF
        { bytes: [0x50, 0x4B, 0x03, 0x04], extension: 'zip/jar' },     // ZIP/JAR
        { bytes: [0x25, 0x50, 0x44, 0x46], extension: 'pdf' },         // PDF
        { bytes: [0x7F, 0x45, 0x4C, 0x46], extension: 'elf' },         // ELF
        { bytes: [0xD0, 0xCF, 0x11, 0xE0], extension: 'doc/xls' },     // MS Office
        { bytes: [0x50, 0x4B, 0x03, 0x04], extension: 'docx/xlsx' }    // MS Office XML
    ];

    constructor() {
        this.gitignoreUtils = new GitignoreUtils();
    }

    /**
     * Check if a file is binary
     */
    private async isBinaryFile(uri: vscode.Uri): Promise<boolean> {
        try {
            // First check if it's a known text file extension
            const ext = path.extname(uri.fsPath).slice(1).toLowerCase();
            if (this.textExtensions.has(ext)) {
                return false;
            }

            // Check for obvious binary extensions
            if (['exe', 'dll', 'so', 'dylib', 'bin', 'obj'].includes(ext)) {
                return true;
            }

            // Read the file header
            const fileContent = await vscode.workspace.fs.readFile(uri);
            if (fileContent.length === 0) {
                return false;
            }

            // Check magic numbers
            for (const magic of this.MAGIC_NUMBERS) {
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

            // Check for NULL bytes (text files shouldn't contain these)
            const hasNullByte = fileContent.includes(0);
            if (hasNullByte) {
                return true;
            }

            // Check the ratio of control characters
            const controlChars = fileContent.filter(byte => 
                (byte < 32 && ![9, 10, 13].includes(byte)) || // Exclude TAB, LF, CR
                (byte >= 0x7F && byte <= 0x9F)               // Extended ASCII control chars
            );
            const controlCharRatio = controlChars.length / fileContent.length;
            if (controlCharRatio > 0.3) { // If more than 30% are control chars, consider it binary
                return true;
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

            // Process directories
            if (type === vscode.FileType.Directory) {
                if (this.excludeDirectories.has(name)) {
                    continue;
                }

                // Process directory recursively
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