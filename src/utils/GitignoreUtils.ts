import * as vscode from 'vscode';
import * as path from 'path';
import ignore from 'ignore';

export class GitignoreUtils {
    private ignoreRules: Map<string, ReturnType<typeof ignore>> = new Map();

    /**
     * 指定されたファイルが.gitignoreで除外対象かチェック
     */
    async isIgnored(uri: vscode.Uri): Promise<boolean> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder) {
            return false;
        }

        try {
            const ig = await this.getIgnoreRules(workspaceFolder.uri);
            if (!ig) {
                return false;
            }

            const relativePath = path.relative(
                workspaceFolder.uri.fsPath,
                uri.fsPath
            ).replace(/\\/g, '/');

            return ig.ignores(relativePath);
        } catch (error) {
            console.error('GitignoreUtils error:', error);
            return false;
        }
    }

    /**
     * .gitignoreルールを取得（キャッシュ付き）
     */
    private async getIgnoreRules(workspaceUri: vscode.Uri): Promise<ReturnType<typeof ignore> | null> {
        const workspacePath = workspaceUri.fsPath;
        
        // キャッシュチェック
        if (this.ignoreRules.has(workspacePath)) {
            return this.ignoreRules.get(workspacePath)!;
        }

        try {
            const gitignorePath = path.join(workspacePath, '.gitignore');
            const gitignoreUri = vscode.Uri.file(gitignorePath);
            
            const document = await vscode.workspace.openTextDocument(gitignoreUri);
            const content = document.getText();

            const ig = ignore().add(content);
            this.ignoreRules.set(workspacePath, ig);
            
            return ig;
        } catch (error) {
            // .gitignoreが存在しない場合など
            return null;
        }
    }
}