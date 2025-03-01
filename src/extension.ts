import * as vscode from 'vscode';
import { CopyCommands } from './commands/CopyCommands';

export function activate(context: vscode.ExtensionContext) {
    const copyCommands = new CopyCommands();

    // エディタコンテキストメニューのコマンド登録
    context.subscriptions.push(
        vscode.commands.registerCommand('otakClipboard.copyCurrentTab', () => {
            copyCommands.copyCurrentTab();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('otakClipboard.copyAllOpenedTabs', () => {
            copyCommands.copyAllOpenedTabs();
        })
    );

    // エクスプローラーコンテキストメニューのコマンド登録
    context.subscriptions.push(
        vscode.commands.registerCommand('otakClipboard.copyFile', (uri: vscode.Uri) => {
            copyCommands.copyFile(uri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('otakClipboard.copyFolder', (uri: vscode.Uri) => {
            copyCommands.copyFolder(uri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('otakClipboard.copyFolderRecursive', (uri: vscode.Uri) => {
            copyCommands.copyFolderRecursive(uri);
        })
    );
}

export function deactivate() {}
