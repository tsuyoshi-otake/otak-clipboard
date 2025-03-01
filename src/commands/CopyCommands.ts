import * as vscode from 'vscode';
import * as path from 'path';
import { ClipboardUtils } from '../utils/ClipboardUtils';
import { FileUtils, FileInfo } from '../utils/FileUtils';
import { LimitChecker } from '../utils/LimitChecker';
import { GitignoreUtils } from '../utils/GitignoreUtils';

export class CopyCommands {
    private readonly clipboardUtils: ClipboardUtils;
    private readonly fileUtils: FileUtils;
    private readonly limitChecker: LimitChecker;
    private readonly gitignoreUtils: GitignoreUtils;

    constructor() {
        this.clipboardUtils = new ClipboardUtils();
        this.fileUtils = new FileUtils();
        this.limitChecker = new LimitChecker();
        this.gitignoreUtils = new GitignoreUtils();
    }

    /**
     * Convert file path to workspace relative path
     */
    private getRelativePath(filePath: string): string {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        return workspaceFolder ? path.relative(workspaceFolder.uri.fsPath, filePath) : path.basename(filePath);
    }

    /**
     * Show notification that auto-dismisses after 5 seconds
     */
    private async showTimedMessage(message: string) {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: message,
                cancellable: false
            },
            async () => {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        );
    }

    /**
     * Copy content of current active editor tab
     */
    async copyCurrentTab(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found.');
            return;
        }

        const text = editor.document.getText();
        if (!this.limitChecker.checkContentSize(text)) {
            return;
        }

        await this.clipboardUtils.copyToClipboard([{
            path: editor.document.fileName,
            content: text,
            isBinary: false
        }]);

        const relativePath = this.getRelativePath(editor.document.fileName);
        await this.showTimedMessage(
            `Copied "${relativePath}" to clipboard.`
        );
    }

    /**
     * Copy content of all opened tabs
     */
    async copyAllOpenedTabs(): Promise<void> {
        // Get all opened tabs
        const allTabs = vscode.window.tabGroups.all
            .map(group => group.tabs)
            .flat()
            .filter(tab => tab.input instanceof vscode.TabInputText)
            .map(tab => (tab.input as vscode.TabInputText).uri);

        if (allTabs.length === 0) {
            vscode.window.showErrorMessage('No open editors found.');
            return;
        }

        const fileContents: FileInfo[] = [];
        for (const uri of allTabs) {
            try {
                const document = await vscode.workspace.openTextDocument(uri);
                fileContents.push({
                    path: uri.fsPath,
                    content: document.getText(),
                    isBinary: false
                });
            } catch (error) {
                console.error(`Failed to read file: ${uri.fsPath}`, error);
                continue;
            }
        }

        if (!this.limitChecker.checkFilesCount(fileContents.length)) {
            return;
        }

        const totalContent = fileContents.map(f => f.content).join('\n');
        if (!this.limitChecker.checkContentSize(totalContent)) {
            return;
        }

        await this.clipboardUtils.copyToClipboard(fileContents);
        const relativePaths = fileContents.map(f => this.getRelativePath(f.path));
        const fileList = relativePaths.join(', ');
        await this.showTimedMessage(
            `Copied ${fileContents.length} tab(s): ${fileList}`
        );
    }

    /**
     * Copy content of specified file
     */
    async copyFile(uri: vscode.Uri): Promise<void> {
        const useGitignore = vscode.workspace.getConfiguration('otakClipboard').get('useGitignore', true);
        if (useGitignore && await this.gitignoreUtils.isIgnored(uri)) {
            vscode.window.showWarningMessage('Selected file is excluded by .gitignore');
            return;
        }

        const content = await this.fileUtils.readFile(uri);
        if (!this.limitChecker.checkContentSize(content)) {
            return;
        }

        await this.clipboardUtils.copyToClipboard([{
            path: uri.fsPath,
            content,
            isBinary: false
        }]);

        const relativePath = this.getRelativePath(uri.fsPath);
        await this.showTimedMessage(
            `Copied "${relativePath}" to clipboard.`
        );
    }

    /**
     * Copy files in directory (non-recursive)
     */
    async copyFolder(uri: vscode.Uri): Promise<void> {
        const files = await this.fileUtils.readFilesInDirectory(uri, false);
        await this.copyFiles(files);
    }

    /**
     * Copy all files in directory (recursive)
     */
    async copyFolderRecursive(uri: vscode.Uri): Promise<void> {
        const files = await this.fileUtils.readFilesInDirectory(uri, true);
        await this.copyFiles(files);
    }

    /**
     * Process multiple files copy operation
     */
    private async copyFiles(files: FileInfo[]): Promise<void> {
        if (files.length === 0) {
            vscode.window.showWarningMessage('No files found to copy.');
            return;
        }

        if (!this.limitChecker.checkFilesCount(files.length)) {
            return;
        }

        // Check size only for text content
        const textContent = files.filter(f => !f.isBinary).map(f => f.content).join('\n');
        if (!this.limitChecker.checkContentSize(textContent)) {
            return;
        }

        await this.clipboardUtils.copyToClipboard(files);

        const relativePaths = files.map(f => this.getRelativePath(f.path));
        const fileList = relativePaths.join(', ');
        await this.showTimedMessage(
            `Copied ${files.length} file(s): ${fileList}`
        );
    }
}