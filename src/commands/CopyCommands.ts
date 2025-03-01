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
    private showTimedMessage(message: string) {
        const notification = vscode.window.showInformationMessage(message);
        notification.then(() => {
            setTimeout(() => {
                // 新しい空の通知を表示して古い通知を消す
                void vscode.window.showInformationMessage('');
            }, 5000);
        });
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

        // シングルファイルはバイナリではないことが確定
        await this.clipboardUtils.copyToClipboard([{
            path: editor.document.fileName,
            content: text,
            isBinary: false
        }]);

        const relativePath = this.getRelativePath(editor.document.fileName);
        this.showTimedMessage(
            `"${relativePath}" をクリップボードにコピーしました。`
        );
    }

    /**
     * 開いている全タブの内容をコピー
     */
    async copyAllOpenedTabs(): Promise<void> {
        const editors = vscode.window.visibleTextEditors;
        if (editors.length === 0) {
            vscode.window.showErrorMessage('開いているエディタが見つかりません。');
            return;
        }

        const fileContents = editors.map(editor => ({
            path: editor.document.fileName,
            content: editor.document.getText(),
            isBinary: false
        }));

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
        this.showTimedMessage(
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

        // シングルファイルはバイナリではないことが確定
        await this.clipboardUtils.copyToClipboard([{
            path: uri.fsPath,
            content,
            isBinary: false
        }]);

        const relativePath = this.getRelativePath(uri.fsPath);
        this.showTimedMessage(
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
        this.showTimedMessage(
            `${files.length}個のファイルをコピーしました: ${fileList}`
        );
    }
}