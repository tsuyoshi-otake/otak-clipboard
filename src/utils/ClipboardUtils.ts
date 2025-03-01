import * as vscode from 'vscode';
import * as path from 'path';

export interface FileContent {
    path: string;
    content: string;
}

export class ClipboardUtils {
    /**
     * 複数のファイル内容をマークダウン形式でクリップボードにコピー
     */
    async copyToClipboard(files: FileContent[]): Promise<void> {
        const markdownContent = this.convertToMarkdown(files);
        await vscode.env.clipboard.writeText(markdownContent);
    }

    /**
     * ファイル内容をマークダウン形式に変換
     */
    private convertToMarkdown(files: FileContent[]): string {
        return files.map(file => {
            const fileName = path.basename(file.path);
            const filePath = file.path;
            const fileExtension = path.extname(fileName).slice(1) || 'txt';
            
            return [
                `# ${filePath}`,
                '',
                '```' + fileExtension,
                file.content,
                '```',
                ''
            ].join('\n');
        }).join('\n');
    }
}