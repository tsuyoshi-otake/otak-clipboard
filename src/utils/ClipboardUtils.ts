import * as vscode from 'vscode';
import * as path from 'path';
import { FileInfo } from './FileUtils';

export class ClipboardUtils {
    /**
     * 複数のファイル内容をマークダウン形式でクリップボードにコピー
     */
    async copyToClipboard(files: FileInfo[]): Promise<void> {
        const markdownContent = this.convertToMarkdown(files);
        await vscode.env.clipboard.writeText(markdownContent);
    }

    /**
     * ファイル内容をマークダウン形式に変換
     */
    private convertToMarkdown(files: FileInfo[]): string {
        return files.map(file => {
            const fileName = path.basename(file.path);
            const filePath = file.path;
            const fileExtension = path.extname(fileName).slice(1) || 'txt';

            if (file.isDirectory) {
                // ディレクトリの場合
                return [
                    `# ${filePath}`,
                    '',
                    '```',
                    file.isEmpty ? `(空のディレクトリ)` : `(ディレクトリ)`,
                    '```',
                    ''
                ].join('\n');
            } else if (file.isBinary) {
                // バイナリファイルの場合
                return [
                    `# ${filePath}`,
                    '',
                    '```',
                    `(バイナリファイル)`,
                    '```',
                    ''
                ].join('\n');
            } else {
                // テキストファイルの場合
                return [
                    `# ${filePath}`,
                    '',
                    '```' + fileExtension,
                    file.content,
                    '```',
                    ''
                ].join('\n');
            }
        }).join('\n');
    }
}