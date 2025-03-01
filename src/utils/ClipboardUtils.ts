import * as vscode from 'vscode';
import * as path from 'path';
import { FileInfo } from './FileUtils';

export class ClipboardUtils {
    /**
     * Copy multiple files to clipboard in markdown format
     */
    async copyToClipboard(files: FileInfo[]): Promise<void> {
        const markdownContent = this.convertToMarkdown(files);
        await vscode.env.clipboard.writeText(markdownContent);
    }

    /**
     * Convert file contents to markdown format
     */
    private convertToMarkdown(files: FileInfo[]): string {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';

        return files.map(file => {
            // 相対パスを取得
            const relativePath = path.relative(workspaceFolder, file.path);

            const fileName = path.basename(file.path);
            const fileExtension = path.extname(fileName).slice(1) || 'txt';

            if (file.isDirectory) {
                // Directory entry
                return [
                    `# ${relativePath}`,
                    '',
                    '```',
                    file.isEmpty ? '(Empty Directory)' : '(Directory)',
                    '```',
                    ''
                ].join('\n');
            } else if (file.isBinary) {
                // Binary file entry
                return [
                    `# ${relativePath}`,
                    '',
                    '```',
                    '(Binary File)',
                    '```',
                    ''
                ].join('\n');
            } else {
                // Text file entry
                return [
                    `# ${relativePath}`,
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