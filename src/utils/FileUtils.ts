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
        '.git',              // Gitディレクトリ
        'node_modules',      // Node.jsの依存関係
        'out',              // ビルド出力
    ]);

    // 一般的なバイナリファイルのマジックナンバー
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
     * ファイルがバイナリかどうかを判定
     */
    private async isBinaryFile(uri: vscode.Uri): Promise<boolean> {
        try {
            // まず拡張子でチェック
            const ext = path.extname(uri.fsPath).slice(1).toLowerCase();
            if (['exe', 'dll', 'so', 'dylib', 'bin', 'obj'].includes(ext)) {
                return true;
            }

            // ファイルの先頭バイトを読み込む
            const fileContent = await vscode.workspace.fs.readFile(uri);
            if (fileContent.length === 0) {
                return false;
            }

            // マジックナンバーでチェック
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

            // NULLバイトの存在をチェック（テキストファイルにはNULLバイトは通常存在しない）
            const hasNullByte = fileContent.includes(0);
            if (hasNullByte) {
                return true;
            }

            // 制御文字の割合をチェック
            const controlChars = fileContent.filter(byte => 
                (byte < 32 && ![9, 10, 13].includes(byte)) || // TAB, LF, CR以外の制御文字
                (byte >= 0x7F && byte <= 0x9F)               // 拡張ASCII制御文字
            );
            const controlCharRatio = controlChars.length / fileContent.length;
            if (controlCharRatio > 0.3) { // 30%以上が制御文字の場合はバイナリと判断
                return true;
            }

            return false;
        } catch (error) {
            // エラーが発生した場合は安全のためバイナリとして扱う
            return true;
        }
    }

    /**
     * 単一ファイルの内容を読み込む
     */
    async readFile(uri: vscode.Uri): Promise<string> {
        const document = await vscode.workspace.openTextDocument(uri);
        return document.getText();
    }

    /**
     * ディレクトリ内のファイルを読み込む
     */
    async readFilesInDirectory(uri: vscode.Uri, recursive: boolean): Promise<FileInfo[]> {
        const results: FileInfo[] = [];
        const useGitignore = vscode.workspace.getConfiguration('otakClipboard').get('useGitignore', true);
        
        try {
            await this.processDirectory(uri, recursive, results, useGitignore);
        } catch (error) {
            vscode.window.showErrorMessage(`ディレクトリの読み込み中にエラーが発生しました: ${error}`);
        }

        return results;
    }

    /**
     * ディレクトリを再帰的に処理
     */
    private async processDirectory(
        uri: vscode.Uri,
        recursive: boolean,
        results: FileInfo[],
        useGitignore: boolean
    ): Promise<void> {
        const entries = await vscode.workspace.fs.readDirectory(uri);

        // ディレクトリ自体を記録
        results.push({
            path: uri.fsPath,
            isDirectory: true,
            isEmpty: entries.length === 0
        });

        for (const [name, type] of entries) {
            const fullPath = path.join(uri.fsPath, name);
            const fileUri = vscode.Uri.file(fullPath);

            // ディレクトリの処理
            if (type === vscode.FileType.Directory) {
                if (this.excludeDirectories.has(name)) {
                    continue;
                }

                // 再帰的にディレクトリを処理
                if (recursive) {
                    await this.processDirectory(fileUri, recursive, results, useGitignore);
                } else {
                    // 非再帰モードでもディレクトリは記録
                    const dirEntries = await vscode.workspace.fs.readDirectory(fileUri);
                    results.push({
                        path: fullPath,
                        isDirectory: true,
                        isEmpty: dirEntries.length === 0
                    });
                }
                continue;
            }

            // ファイルの処理
            if (type === vscode.FileType.File) {
                // .gitignoreチェック
                if (useGitignore && await this.gitignoreUtils.isIgnored(fileUri)) {
                    continue;
                }

                const isBinary = await this.isBinaryFile(fileUri);
                if (isBinary) {
                    // バイナリファイルの場合は、パスのみを記録
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
                    // 読み取り不可能なファイルは無視
                    continue;
                }
            }
        }
    }
}