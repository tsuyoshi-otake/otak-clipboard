import * as vscode from 'vscode';
import { I18nManager } from '../i18n/I18nManager';

export interface ContentLimits {
    maxCharacters: number;
    maxFiles: number;
}

export type LimitExceededKind = 'characters' | 'files';

export class LimitExceededError extends Error {
    constructor(
        public readonly kind: LimitExceededKind,
        public readonly actual: number,
        public readonly limit: number
    ) {
        super(`${kind} limit exceeded: ${actual} > ${limit}`);
    }
}

export class ContentBudget {
    private fileCount = 0;
    private characterCount = 0;

    constructor(public readonly limits: ContentLimits) {}

    addFile(count: number = 1): void {
        const nextCount = this.fileCount + count;
        if (nextCount > this.limits.maxFiles) {
            throw new LimitExceededError('files', nextCount, this.limits.maxFiles);
        }

        this.fileCount = nextCount;
    }

    addContent(content: string): void {
        const nextCount = this.characterCount + content.length;
        if (nextCount > this.limits.maxCharacters) {
            throw new LimitExceededError('characters', nextCount, this.limits.maxCharacters);
        }

        this.characterCount = nextCount;
    }
}

export class LimitChecker {
    /**
     * Get configuration values
     */
    getLimits(): ContentLimits {
        const config = vscode.workspace.getConfiguration('otakClipboard');
        return {
            maxCharacters: config.get<number>('maxCharacters', 400000),
            maxFiles: config.get<number>('maxFiles', 400)
        };
    }

    createBudget(): ContentBudget {
        return new ContentBudget(this.getLimits());
    }

    /**
     * Check if content size is within limits
     */
    checkContentSize(content: string): boolean {
        try {
            this.createBudget().addContent(content);
            return true;
        } catch (error) {
            return this.reportLimitError(error);
        }
    }

    /**
     * Check if file count is within limits
     */
    checkFilesCount(count: number): boolean {
        try {
            this.createBudget().addFile(count);
            return true;
        } catch (error) {
            return this.reportLimitError(error);
        }
    }

    reportLimitError(error: unknown): boolean {
        if (!(error instanceof LimitExceededError)) {
            return false;
        }

        const i18n = I18nManager.getInstance();

        if (error.kind === 'characters') {
            vscode.window.showErrorMessage(
                i18n.t('error.contentTooLarge', { limit: String(error.limit) })
            );
        } else {
            vscode.window.showErrorMessage(
                i18n.t('error.tooManyFiles', { limit: String(error.limit) })
            );
        }

        return true;
    }
}
