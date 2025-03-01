import * as vscode from 'vscode';
import { ClipboardUtils } from '../utils/ClipboardUtils';
import { FileUtils } from '../utils/FileUtils';
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
            content: text
        }]);

        vscode.window.showInformationMessage('✅ 現在のタブをクリップボードにコピーしました。');
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
            content: editor.document.getText()
        }));

        if (!this.limitChecker.checkFilesCount(fileContents.length)) {
            return;
        }

        const totalContent = fileContents.map(f => f.content).join('\n');
        if (!this.limitChecker.checkContentSize(totalContent)) {
            return;
        }

        await this.clipboardUtils.copyToClipboard(fileContents);
        vscode.window.showInformationMessage(`✅ ${fileContents.length}個のタブをクリップボードにコピーしました。`);
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
            content
        }]);

        vscode.window.showInformationMessage('✅ ファイルをクリップボードにコピーしました。');
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
    private async copyFiles(files: { path: string; content: string }[]): Promise<void> {
        if (files.length === 0) {
            vscode.window.showWarningMessage('コピー可能なファイルが見つかりません。');
            return;
        }

        if (!this.limitChecker.checkFilesCount(files.length)) {
            return;
        }

        const totalContent = files.map(f => f.content).join('\n');
        if (!this.limitChecker.checkContentSize(totalContent)) {
            return;
        }

        await this.clipboardUtils.copyToClipboard(files);

        const message = `✅ ${files.length}個のファイルをクリップボードにコピーしました。`;
        vscode.window.showInformationMessage(message);
    }
}