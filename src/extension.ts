import * as vscode from 'vscode';
import { CopyCommands } from './commands/CopyCommands';
import { I18nManager } from './i18n/I18nManager';

export function activate(context: vscode.ExtensionContext) {
    I18nManager.getInstance().initialize();

    const copyCommands = new CopyCommands();
    context.subscriptions.push(copyCommands);

    // エディタコンテキストメニューのコマンド登録
    context.subscriptions.push(
        vscode.commands.registerCommand('otakClipboard.copyCurrentTab', () => {
            return runCommand(() => copyCommands.copyCurrentTab());
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('otakClipboard.copyAllOpenedTabs', () => {
            return runCommand(() => copyCommands.copyAllOpenedTabs());
        })
    );

    // エクスプローラーコンテキストメニューのコマンド登録
    context.subscriptions.push(
        vscode.commands.registerCommand('otakClipboard.copyFile', (uri: vscode.Uri) => {
            return runCommand(() => copyCommands.copyFile(uri));
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('otakClipboard.copyFolder', (uri: vscode.Uri) => {
            return runCommand(() => copyCommands.copyFolder(uri));
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('otakClipboard.copyFolderRecursive', (uri: vscode.Uri) => {
            return runCommand(() => copyCommands.copyFolderRecursive(uri));
        })
    );
}

export function deactivate() {}

async function runCommand(command: () => Promise<void>): Promise<void> {
    try {
        await command();
    } catch (error) {
        console.error('otak-clipboard command failed:', error);
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(I18nManager.getInstance().t('error.commandFailed', { message }));
    }
}
