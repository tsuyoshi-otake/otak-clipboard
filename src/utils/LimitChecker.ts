import * as vscode from 'vscode';

export class LimitChecker {
    /**
     * Get configuration values
     */
    private getConfig() {
        const config = vscode.workspace.getConfiguration('otakClipboard');
        return {
            maxCharacters: config.get<number>('maxCharacters', 400000),
            maxFiles: config.get<number>('maxFiles', 50)
        };
    }

    /**
     * Check if content size is within limits
     */
    checkContentSize(content: string): boolean {
        const config = this.getConfig();
        if (content.length > config.maxCharacters) {
            vscode.window.showErrorMessage(
                `Content is too large. Maximum size is approximately ${config.maxCharacters} characters.\n` +
                `Please reduce the selection and try again.`
            );
            return false;
        }
        return true;
    }

    /**
     * Check if file count is within limits
     */
    checkFilesCount(count: number): boolean {
        const config = this.getConfig();
        if (count > config.maxFiles) {
            vscode.window.showErrorMessage(
                `Too many files selected. Maximum limit is ${config.maxFiles} files.\n` +
                `Please reduce the selection and try again.`
            );
            return false;
        }
        return true;
    }
}