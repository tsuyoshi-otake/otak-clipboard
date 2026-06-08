import * as path from 'path';
import * as vscode from 'vscode';

export function getWorkspaceRelativePath(uriOrPath: vscode.Uri | string): string {
    const uri = typeof uriOrPath === 'string' ? vscode.Uri.file(uriOrPath) : uriOrPath;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);

    if (workspaceFolder) {
        if (uri.scheme === 'file' && workspaceFolder.uri.scheme === 'file') {
            return path.relative(workspaceFolder.uri.fsPath, uri.fsPath).replace(/\\/g, '/');
        }

        return path.posix.relative(workspaceFolder.uri.path, uri.path);
    }

    if (uri.scheme === 'file') {
        return path.basename(uri.fsPath);
    }

    const segments = uri.path.split('/').filter(Boolean);
    return segments[segments.length - 1] || uri.toString();
}
