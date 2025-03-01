import * as vscode from 'vscode';
import * as path from 'path';
import { GitignoreUtils } from './GitignoreUtils';

export interface FileInfo {
    path: string;
    content?: string;
    isBinary?: boolean;
}

export class FileUtils {
    private readonly gitignoreUtils: GitignoreUtils;
    private readonly excludeExtensions = new Set([
        // バイナリファイル
        'exe', 'dll', 'so', 'dylib', 'bin', 'obj',
        // 画像ファイル
        'jpg', 'jpeg', 'png', 'gif', 'bmp', 'ico', 'svg',
        // 圧縮ファイル
        'zip', 'rar', '7z', 'tar', 'gz',
        // その他バイナリ
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'db', 'sqlite'
    ]);

    private readonly excludeDirectories = new Set([
        '.git',              // Gitディレクトリ
        'node_modules',      // Node.jsの依存関係
        'out',              // ビルド出力
    ]);

    constructor() {
        this.gitignoreUtils = new GitignoreUtils();
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

        for (const [name, type] of entries) {
            const fullPath = path.join(uri.fsPath, name);
            const fileUri = vscode.Uri.file(fullPath);

            // 除外するディレクトリをスキップ
            if (type === vscode.FileType.Directory) {
                if (this.excludeDirectories.has(name)) {
                    continue;
                }
                if (recursive) {
                    await this.processDirectory(fileUri, recursive, results, useGitignore);
                }
                continue;
            }

            // ファイルの処理
            if (type === vscode.FileType.File) {
                // .gitignoreチェック
                if (useGitignore && await this.gitignoreUtils.isIgnored(fileUri)) {
                    continue;
                }

                // 拡張子チェック
                const ext = path.extname(name).slice(1).toLowerCase();
                if (this.excludeExtensions.has(ext)) {
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