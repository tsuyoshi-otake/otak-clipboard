import * as vscode from 'vscode';
import { ClipboardUtils } from '../utils/ClipboardUtils';
import { FileUtils, FileInfo } from '../utils/FileUtils';
import { ContentBudget, LimitChecker } from '../utils/LimitChecker';
import { GitignoreUtils } from '../utils/GitignoreUtils';
import { SensitiveDataDetector, USER_CANCELLED_ERROR_MESSAGE } from '../utils/SensitiveDataDetector';
import { getWorkspaceRelativePath } from '../utils/WorkspacePathUtils';
import { I18nManager } from '../i18n/I18nManager';

interface SensitiveProcessingResult {
    files: FileInfo[];
    masked: boolean;
}

type CopiedItemKind = 'tab' | 'file';

export class CopyCommands implements vscode.Disposable {
    private readonly clipboardUtils: ClipboardUtils;
    private readonly fileUtils: FileUtils;
    private readonly limitChecker: LimitChecker;
    private readonly gitignoreUtils: GitignoreUtils;
    private readonly sensitiveDataDetector: SensitiveDataDetector;
    private readonly i18n: I18nManager;

    constructor(
        clipboardUtils?: ClipboardUtils,
        gitignoreUtils?: GitignoreUtils,
        fileUtils?: FileUtils,
        limitChecker?: LimitChecker,
        sensitiveDataDetector?: SensitiveDataDetector
    ) {
        this.clipboardUtils = clipboardUtils ?? new ClipboardUtils();
        this.gitignoreUtils = gitignoreUtils ?? new GitignoreUtils();
        this.fileUtils = fileUtils ?? new FileUtils(this.gitignoreUtils);
        this.limitChecker = limitChecker ?? new LimitChecker();
        this.sensitiveDataDetector = sensitiveDataDetector ?? new SensitiveDataDetector();
        this.i18n = I18nManager.getInstance();
    }

    async copyCurrentTab(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage(this.i18n.t('error.noActiveEditor'));
            return;
        }

        const budget = this.limitChecker.createBudget();
        const text = editor.document.getText();
        budget.addFile();
        budget.addContent(text);

        await this.copyPreparedFiles([{
            path: editor.document.uri.fsPath,
            uri: editor.document.uri,
            content: text,
            isBinary: false
        }], 'tab');
    }

    async copyAllOpenedTabs(): Promise<void> {
        const allTabs = vscode.window.tabGroups.all
            .flatMap(group => group.tabs)
            .filter(tab => tab.input instanceof vscode.TabInputText)
            .map(tab => (tab.input as vscode.TabInputText).uri);

        if (allTabs.length === 0) {
            vscode.window.showErrorMessage(this.i18n.t('error.noOpenEditors'));
            return;
        }

        const budget = this.limitChecker.createBudget();
        const files: FileInfo[] = [];

        for (const uri of allTabs) {
            try {
                const document = await vscode.workspace.openTextDocument(uri);
                const content = document.getText();
                budget.addFile();
                budget.addContent(content);
                files.push({
                    path: uri.fsPath,
                    uri,
                    content,
                    isBinary: false
                });
            } catch (error) {
                if (this.limitChecker.reportLimitError(error)) {
                    return;
                }
                console.error(`Failed to read file: ${uri.toString()}`, error);
            }
        }

        await this.copyPreparedFiles(files, 'tab');
    }

    async copyFile(uri: vscode.Uri): Promise<void> {
        const config = vscode.workspace.getConfiguration('otakClipboard');
        const useGitignore = config.get('useGitignore', true);
        if (useGitignore && await this.gitignoreUtils.isIgnored(uri)) {
            vscode.window.showWarningMessage(this.i18n.t('warning.fileExcludedByGitignore'));
            return;
        }

        try {
            const budget = this.limitChecker.createBudget();
            const file = await this.fileUtils.readSingleFile(uri, budget);
            await this.copyPreparedFiles([file], 'file');
        } catch (error) {
            if (!this.limitChecker.reportLimitError(error)) {
                throw error;
            }
        }
    }

    async copyFolder(uri: vscode.Uri): Promise<void> {
        await this.copyFolderInternal(uri, false);
    }

    async copyFolderRecursive(uri: vscode.Uri): Promise<void> {
        await this.copyFolderInternal(uri, true);
    }

    dispose(): void {
        this.gitignoreUtils.dispose();
    }

    private async copyFolderInternal(uri: vscode.Uri, recursive: boolean): Promise<void> {
        try {
            const budget = this.limitChecker.createBudget();
            const files = await this.fileUtils.readFilesInDirectory(uri, recursive, budget);
            await this.copyPreparedFiles(files, 'file');
        } catch (error) {
            if (!this.limitChecker.reportLimitError(error)) {
                throw error;
            }
        }
    }

    private async copyPreparedFiles(files: FileInfo[], itemKind: CopiedItemKind): Promise<void> {
        if (files.length === 0) {
            vscode.window.showWarningMessage(this.i18n.t('warning.noFilesFound'));
            return;
        }

        const processingResult = await this.processSensitiveData(files);
        if (processingResult.files.length === 0) {
            return;
        }

        await this.clipboardUtils.copyToClipboard(processingResult.files);

        vscode.window.showInformationMessage(
            this.createCopiedMessage(files, itemKind, processingResult.masked)
        );
    }

    private async processSensitiveData(files: FileInfo[]): Promise<SensitiveProcessingResult> {
        const config = vscode.workspace.getConfiguration('otakClipboard');
        const enableSensitiveDetection = config.get('detectSensitiveData', true);
        if (!enableSensitiveDetection) {
            return { files, masked: false };
        }

        const processedFiles: FileInfo[] = [];
        let masked = false;

        for (const file of files) {
            if (file.isBinary || file.isDirectory || !file.content) {
                processedFiles.push(file);
                continue;
            }

            try {
                const matches = await this.sensitiveDataDetector.detectSensitiveData(file.content, file.path);
                if (matches.length === 0) {
                    processedFiles.push(file);
                    continue;
                }

                const result = await this.sensitiveDataDetector.promptUserForMasking(matches, file.content);
                processedFiles.push({
                    ...file,
                    content: result.content
                });
                masked = masked || result.masked;
            } catch (error) {
                if (error instanceof Error && error.message === USER_CANCELLED_ERROR_MESSAGE) {
                    return { files: [], masked: false };
                }
                throw error;
            }
        }

        return { files: processedFiles, masked };
    }

    private createCopiedMessage(files: FileInfo[], itemKind: CopiedItemKind, masked: boolean): string {
        const copiedFiles = files.filter(file => !file.isDirectory);
        const messageFiles = copiedFiles.length > 0 ? copiedFiles : files;
        const count = messageFiles.length;
        const paths = messageFiles.slice(0, 5).map(file => getWorkspaceRelativePath(file.uri ?? file.path));
        const remainingCount = Math.max(0, count - paths.length);
        const itemLabelKey = count === 1 ? `label.${itemKind}` : `label.${itemKind}s`;
        const itemLabel = this.i18n.t(itemLabelKey);
        const suffix = remainingCount > 0
            ? this.i18n.t('message.remainingCount', { count: String(remainingCount) })
            : '';
        const maskedStatus = masked ? this.i18n.t('message.maskedStatus') : '';

        return this.i18n.t('message.copied', {
            count: String(count),
            itemLabel,
            paths: paths.join(', '),
            suffix,
            maskedStatus
        });
    }
}
