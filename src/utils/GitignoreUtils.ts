import * as vscode from 'vscode';
import * as path from 'path';
import ignore from 'ignore';

export class GitignoreUtils implements vscode.Disposable {
    private ignoreRules: Map<string, ReturnType<typeof ignore> | null> = new Map();
    private readonly watcher: vscode.FileSystemWatcher;

    constructor() {
        this.watcher = vscode.workspace.createFileSystemWatcher('**/.gitignore');
        this.watcher.onDidChange(uri => this.invalidateWorkspace(uri));
        this.watcher.onDidCreate(uri => this.invalidateWorkspace(uri));
        this.watcher.onDidDelete(uri => this.invalidateWorkspace(uri));
    }

    /**
     * Check if a file is ignored by .gitignore
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

            const relativePath = this.getRelativePath(workspaceFolder.uri, uri);

            return ig.ignores(relativePath);
        } catch (error) {
            console.error('GitignoreUtils error:', error);
            return false;
        }
    }

    /**
     * Get .gitignore rules with caching
     */
    private async getIgnoreRules(workspaceUri: vscode.Uri): Promise<ReturnType<typeof ignore> | null> {
        const workspaceKey = workspaceUri.toString();

        if (this.ignoreRules.has(workspaceKey)) {
            return this.ignoreRules.get(workspaceKey) ?? null;
        }

        try {
            const gitignoreUri = vscode.Uri.joinPath(workspaceUri, '.gitignore');
            const content = new TextDecoder().decode(await vscode.workspace.fs.readFile(gitignoreUri));

            const ig = ignore().add(content);
            this.ignoreRules.set(workspaceKey, ig);

            return ig;
        } catch (error) {
            this.ignoreRules.set(workspaceKey, null);
            return null;
        }
    }

    private invalidateWorkspace(uri: vscode.Uri): void {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (workspaceFolder) {
            this.ignoreRules.delete(workspaceFolder.uri.toString());
        } else {
            this.ignoreRules.clear();
        }
    }

    dispose(): void {
        this.watcher.dispose();
        this.ignoreRules.clear();
    }

    private getRelativePath(workspaceUri: vscode.Uri, uri: vscode.Uri): string {
        if (workspaceUri.scheme === 'file' && uri.scheme === 'file') {
            return path.relative(workspaceUri.fsPath, uri.fsPath).replace(/\\/g, '/');
        }

        return path.posix.relative(workspaceUri.path, uri.path);
    }
}
