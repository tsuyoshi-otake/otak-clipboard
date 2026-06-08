import * as vscode from 'vscode';
import * as path from 'path';
import { FileInfo } from './FileUtils';
import { getWorkspaceRelativePath } from './WorkspacePathUtils';

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
    public convertToMarkdown(files: FileInfo[]): string {
        const chunks: string[] = [];

        for (const file of files) {
            chunks.push(this.convertFileToMarkdown(file));
        }

        return chunks.join('\n');
    }

    private convertFileToMarkdown(file: FileInfo): string {
        const relativePath = getWorkspaceRelativePath(file.uri ?? file.path);
        const fileName = path.basename(file.path);
        const fileExtension = path.extname(fileName).slice(1) || 'txt';

        if (file.isDirectory) {
            return this.createBlock(relativePath, '', file.isEmpty ? '(Empty Directory)' : '(Directory)');
        }

        if (file.isBinary) {
            return this.createBlock(relativePath, '', '(Binary File)');
        }

        return this.createBlock(relativePath, fileExtension, file.content ?? '');
    }

    private createBlock(relativePath: string, language: string, content: string): string {
        const fence = this.createFence(content);

        return [
            `# ${relativePath}`,
            '',
            `${fence}${language}`,
            content,
            fence,
            ''
        ].join('\n');
    }

    private createFence(content: string): string {
        let fence = '```';
        while (content.includes(fence)) {
            fence += '`';
        }

        return fence;
    }
}
