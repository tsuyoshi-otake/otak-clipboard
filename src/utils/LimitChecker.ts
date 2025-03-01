import * as vscode from 'vscode';

export class LimitChecker {
    private readonly MAX_CHARACTERS = 400000; // About 100K tokens
    private readonly MAX_FILES = 50;

    /**
     * Check if content size is within limits
     */
    checkContentSize(content: string): boolean {
        if (content.length > this.MAX_CHARACTERS) {
            vscode.window.showErrorMessage(
                `Content is too large. Maximum size is approximately ${this.MAX_CHARACTERS} characters.\n` +
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
        if (count > this.MAX_FILES) {
            vscode.window.showErrorMessage(
                `Too many files selected. Maximum limit is ${this.MAX_FILES} files.\n` +
                `Please reduce the selection and try again.`
            );
            return false;
        }
        return true;
    }
}