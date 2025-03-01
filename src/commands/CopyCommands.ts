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
     * ファイルパスをワークスペースからの相対パスに変換
     */
    private getRelativePath(filePath: string): string {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        return workspaceFolder ? path.relative(workspaceFolder.uri.fsPath, filePath) : path.basename(filePath);
    }

    /**
     * 5秒後に自動で消える通知を表示
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
     * 現在アクティブなエディタのタブ内容をコピー
     */
    async copyCurrentTab(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('アクティブなエディタが見つかりません。');
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
            `"${relativePath}" をクリップボードにコピーしました。`
        );
    }

    /**
     * 開いている全タブの内容をコピー
     */
    async copyAllOpenedTabs(): Promise<void> {
        // すべての開いているタブを取得
        const allTabs = vscode.window.tabGroups.all
            .map(group => group.tabs)
            .flat()
            .filter(tab => tab.input instanceof vscode.TabInputText)
            .map(tab => (tab.input as vscode.TabInputText).uri);

        if (allTabs.length === 0) {
            vscode.window.showErrorMessage('開いているエディタが見つかりません。');
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
            `${fileContents.length}個のタブをコピーしました: ${fileList}`
        );
    }

    /**
     * 指定されたファイルの内容をコピー
     */
    async copyFile(uri: vscode.Uri): Promise<void> {
        const useGitignore = vscode.workspace.getConfiguration('otakClipboard').get('useGitignore', true);
        if (useGitignore && await this.gitignoreUtils.isIgnored(uri)) {
            vscode.window.showWarningMessage('選択されたファイルは.gitignoreによって除外されています。');
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
            `"${relativePath}" をクリップボードにコピーしました。`
        );
    }

    /**
     * フォルダ内のファイルをコピー（直下のみ）
     */
    async copyFolder(uri: vscode.Uri): Promise<void> {
        const files = await this.fileUtils.readFilesInDirectory(uri, false);
        await this.copyFiles(files);
    }

    /**
     * フォルダ内の全ファイルをコピー（再帰的）
     */
    async copyFolderRecursive(uri: vscode.Uri): Promise<void> {
        const files = await this.fileUtils.readFilesInDirectory(uri, true);
        await this.copyFiles(files);
    }

    /**
     * 複数ファイルのコピー処理を実行
     */
    private async copyFiles(files: FileInfo[]): Promise<void> {
        if (files.length === 0) {
            vscode.window.showWarningMessage('コピー可能なファイルが見つかりません。');
            return;
        }

        if (!this.limitChecker.checkFilesCount(files.length)) {
            return;
        }

        // テキストファイルの内容のみを結合してサイズチェック
        const textContent = files.filter(f => !f.isBinary).map(f => f.content).join('\n');
        if (!this.limitChecker.checkContentSize(textContent)) {
            return;
        }

        await this.clipboardUtils.copyToClipboard(files);

        const relativePaths = files.map(f => this.getRelativePath(f.path));
        const fileList = relativePaths.join(', ');
        await this.showTimedMessage(
            `${files.length}個のファイルをコピーしました: ${fileList}`
        );
    }
}