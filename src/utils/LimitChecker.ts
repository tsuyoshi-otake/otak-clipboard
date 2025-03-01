import * as vscode from 'vscode';

export class LimitChecker {
    private readonly MAX_CHARACTERS = 400000; // 約100Kトークン
    private readonly MAX_FILES = 50;

    /**
     * コンテンツのサイズが制限内かチェック
     */
    checkContentSize(content: string): boolean {
        if (content.length > this.MAX_CHARACTERS) {
            vscode.window.showErrorMessage(
                `対象が多すぎます。一度にコピー可能な上限（約400,000文字）を超えています。\n` +
                `範囲を減らして再試行してください。`
            );
            return false;
        }
        return true;
    }

    /**
     * ファイル数が制限内かチェック
     */
    checkFilesCount(count: number): boolean {
        if (count > this.MAX_FILES) {
            vscode.window.showErrorMessage(
                `対象が多すぎます。一度にコピー可能な上限（${this.MAX_FILES}ファイル）を超えています。\n` +
                `範囲を減らして再試行してください。`
            );
            return false;
        }
        return true;
    }
}