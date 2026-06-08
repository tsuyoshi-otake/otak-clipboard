import * as vscode from 'vscode';
import { I18nManager } from '../i18n/I18nManager';

export const USER_CANCELLED_ERROR_MESSAGE = 'Operation cancelled by user';

export interface SensitiveDataMatch {
    type: string;
    value: string;
    line: number;
    column: number;
    confidence: 'high' | 'medium' | 'low';
    context?: string;
}

export interface MaskingOption {
    mask: boolean;
    pattern?: string;
    showPartial?: boolean;
}

interface SensitiveDataPattern {
    regex: RegExp;
    confidence: 'high' | 'medium' | 'low';
}

interface CustomSensitiveDataPattern {
    name: string;
    pattern: string;
    confidence: 'high' | 'medium' | 'low';
}

export class SensitiveDataDetector {
    private patterns: Map<string, SensitiveDataPattern>;

    constructor() {
        this.patterns = new Map([
            // High confidence patterns - very specific formats
            ['AWS Access Key', {
                regex: /\b(AKIA[0-9A-Z]{16})\b/gi,
                confidence: 'high'
            }],
            ['AWS Secret Key', {
                regex: /\b([0-9a-zA-Z/+=]{40})\b/gi,
                confidence: 'medium'  // Could be other base64 strings
            }],
            ['GitHub Personal Access Token', {
                regex: /\b(ghp_[a-zA-Z0-9]{36,})\b/gi,
                confidence: 'high'
            }],
            ['GitHub OAuth Token', {
                regex: /\b(gho_[a-zA-Z0-9]{36,})\b/gi,
                confidence: 'high'
            }],
            ['GitHub App Token', {
                regex: /\b(ghs_[a-zA-Z0-9]{36,})\b/gi,
                confidence: 'high'
            }],
            ['GitHub Refresh Token', {
                regex: /\b(ghr_[a-zA-Z0-9]{36,})\b/gi,
                confidence: 'high'
            }],
            ['Slack Token', {
                regex: /\b(xox[baprs]-[a-zA-Z0-9-]+)\b/gi,
                confidence: 'high'
            }],
            ['Stripe API Key', {
                regex: /\b(sk_(live|test)_[a-zA-Z0-9]{24,})\b/gi,
                confidence: 'high'
            }],
            ['NPM Token', {
                regex: /\b(npm_[a-zA-Z0-9]{36,})\b/gi,
                confidence: 'high'
            }],
            ['JWT Token', {
                regex: /\b(eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)\b/gi,
                confidence: 'high'
            }],
            ['OpenAI API Key', {
                regex: /\b(sk-[a-zA-Z0-9\-_]{20,})\b/gi,
                confidence: 'high'
            }],
            ['Anthropic API Key', {
                regex: /\b(sk-ant-[a-zA-Z0-9-_]{90,})\b/gi,
                confidence: 'high'
            }],
            ['Google API Key', {
                regex: /\b(AIza[0-9A-Za-z\-_]{35})\b/gi,
                confidence: 'high'
            }],
            ['Firebase API Key', {
                regex: /\b(AIza[0-9A-Za-z\-_]{35})\b/gi,
                confidence: 'high'
            }],
            ['SendGrid API Key', {
                regex: /\b(SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43})\b/gi,
                confidence: 'high'
            }],
            ['Twilio API Key', {
                regex: /\b(SK[a-f0-9]{32})\b/gi,
                confidence: 'high'
            }],
            ['Mailgun API Key', {
                regex: /\b(key-[a-f0-9]{32})\b/gi,
                confidence: 'high'
            }],
            ['Discord Token', {
                regex: /\b([MN][a-zA-Z0-9]{23}\.[a-zA-Z0-9-_]{6}\.[a-zA-Z0-9-_]{27})\b/gi,
                confidence: 'high'
            }],
            ['Discord Webhook', {
                regex: /https:\/\/discord(app)?\.com\/api\/webhooks\/[0-9]+\/[a-zA-Z0-9_-]+/gi,
                confidence: 'high'
            }],
            ['Slack Webhook', {
                regex: /https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[a-zA-Z0-9]+/gi,
                confidence: 'high'
            }],
            ['GitHub Fine-Grained PAT', {
                regex: /\b(github_pat_[a-zA-Z0-9_]+)\b/gi,
                confidence: 'high'
            }],
            ['Azure Client Secret', {
                regex: /\b([a-zA-Z0-9~]{34,})\b/gi,
                confidence: 'low'  // Too generic, many false positives
            }],
            ['OCI OCID', {
                regex: /\b(ocid1\.[a-z]+\.oc[0-9]\.\.[a-z0-9]{60,})\b/gi,
                confidence: 'high'
            }],

            // Medium confidence - could be legitimate but worth checking
            ['Generic API Key', {
                regex: /\b(api[_-]?key\s*[=:]\s*["']?[a-zA-Z0-9_\-]{20,}["']?)\b/gi,
                confidence: 'medium'
            }],
            ['Generic Secret', {
                regex: /\b(secret\s*[=:]\s*["']?[a-zA-Z0-9_\-]{20,}["']?)\b/gi,
                confidence: 'medium'
            }],
            ['Generic Token', {
                regex: /\b(token\s*[=:]\s*["']?[a-zA-Z0-9_\-]{20,}["']?)\b/gi,
                confidence: 'medium'
            }],
            ['Generic Password', {
                regex: /\b(password\s*[=:]\s*["']?[^\s"']{8,}["']?)\b/gi,
                confidence: 'medium'
            }],
            ['Private Key Header', {
                regex: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/gi,
                confidence: 'high'
            }],
            ['Database Connection String', {
                regex: /\b(mongodb(\+srv)?:\/\/[^\s]+|postgres:\/\/[^\s]+|mysql:\/\/[^\s]+)\b/gi,
                confidence: 'high'
            }],
            ['Bearer Token', {
                regex: /\b(Bearer\s+[a-zA-Z0-9_\-\.]+)\b/gi,
                confidence: 'medium'
            }],

            // Environment variable patterns
            ['Environment Variable', {
                regex: /\b(process\.env\.[A-Z_]+_(?:KEY|TOKEN|SECRET|PASSWORD))\b/gi,
                confidence: 'low'
            }],
        ]);
    }

    public async detectSensitiveData(content: string, filePath: string): Promise<SensitiveDataMatch[]> {
        const matches: SensitiveDataMatch[] = [];
        const lines = content.split('\n');
        const patterns = this.getConfiguredPatterns();
        const normalizedPath = filePath.replace(/\\/g, '/');

        // Skip detection for certain file types
        const skipExtensions = ['.md', '.txt', '.log', '.lock'];
        if (skipExtensions.some(ext => normalizedPath.endsWith(ext))) {
            return matches;
        }

        // Check if it's likely a test/example file
        const isTestFile = /\.(test|spec|example|sample)\./i.test(normalizedPath) ||
                          normalizedPath.includes('/test/') ||
                          normalizedPath.includes('/tests/') ||
                          normalizedPath.includes('/examples/');

        lines.forEach((line, lineIndex) => {
            // Skip comments (basic implementation - could be improved)
            const isComment = line.trim().startsWith('//') ||
                            line.trim().startsWith('#') ||
                            line.trim().startsWith('*') ||
                            line.trim().startsWith('<!--');

            patterns.forEach((patternInfo, type) => {
                const regex = new RegExp(patternInfo.regex);
                let match;

                while ((match = regex.exec(line)) !== null) {
                    // Apply context-aware confidence adjustment
                    let confidence = patternInfo.confidence;

                    // Lower confidence for comments
                    if (isComment) {
                        confidence = confidence === 'high' ? 'medium' : 'low';
                    }

                    // Lower confidence for test files
                    if (isTestFile) {
                        confidence = confidence === 'high' ? 'medium' : 'low';
                    }

                    // Check for common fake/example patterns
                    const value = match[1] || match[0];
                    if (this.isLikelyFakeValue(value)) {
                        confidence = 'low';
                    }

                    matches.push({
                        type,
                        value: value,
                        line: lineIndex + 1,
                        column: match.index,
                        confidence,
                        context: line.substring(Math.max(0, match.index - 20), Math.min(line.length, match.index + value.length + 20))
                    });
                }
            });
        });

        return matches;
    }

    private getConfiguredPatterns(): Map<string, SensitiveDataPattern> {
        const patterns = new Map(this.patterns);
        const config = vscode.workspace.getConfiguration('otakClipboard');
        const customPatterns = config.get<CustomSensitiveDataPattern[]>('sensitiveDataPatterns', []);

        for (const customPattern of customPatterns) {
            if (!customPattern.name || !customPattern.pattern || !customPattern.confidence) {
                continue;
            }

            try {
                patterns.set(customPattern.name, {
                    regex: new RegExp(customPattern.pattern, 'gi'),
                    confidence: customPattern.confidence
                });
            } catch (error) {
                console.error(`Invalid sensitive data pattern "${customPattern.name}":`, error);
            }
        }

        return patterns;
    }

    private getMaskShowPartial(): boolean {
        return vscode.workspace.getConfiguration('otakClipboard').get('maskShowPartial', true);
    }

    private isLikelyFakeValue(value: string): boolean {
        const fakePatterns = [
            /^(xxx+|your[_-]?api[_-]?key|your[_-]?token|example|sample|demo|test|dummy|placeholder|changeme)/i,
            /^[a-z]+$/,  // All lowercase (unlikely for real keys)
            /^[A-Z]+$/,  // All uppercase (might be valid but often placeholder)
            /^(1234|0000|1111|abcd|test)/i,
            /\$\{[^}]+\}/,  // Template variable
            /\{\{[^}]+\}\}/,  // Another template format
        ];

        return fakePatterns.some(pattern => pattern.test(value));
    }

    public maskValue(value: string, showPartial: boolean = true): string {
        if (!showPartial) {
            return '*'.repeat(value.length);
        }

        const len = value.length;
        if (len <= 8) {
            return '*'.repeat(len);
        } else if (len <= 20) {
            // Show first 2 and last 2 characters
            return value.substring(0, 2) + '*'.repeat(len - 4) + value.substring(len - 2);
        } else {
            // Show first 4 and last 4 characters
            return value.substring(0, 4) + '*'.repeat(len - 8) + value.substring(len - 4);
        }
    }

    public async promptUserForMasking(
        matches: SensitiveDataMatch[],
        content: string
    ): Promise<{ content: string; masked: boolean }> {
        if (matches.length === 0) {
            return { content, masked: false };
        }
        const showPartial = this.getMaskShowPartial();
        const i18n = I18nManager.getInstance();

        // Group matches by confidence
        const highConfidence = matches.filter(m => m.confidence === 'high');
        const mediumConfidence = matches.filter(m => m.confidence === 'medium');
        const lowConfidence = matches.filter(m => m.confidence === 'low');

        // Build message
        let message = i18n.t('message.sensitiveDataDetected', { count: String(matches.length) });

        if (highConfidence.length > 0) {
            message += i18n.t('message.highConfidenceItems', { count: String(highConfidence.length) });
            const grouped = this.groupByType(highConfidence);
            for (const [type, items] of Object.entries(grouped)) {
                message += i18n.t('message.sensitiveDataTypeCount', {
                    type,
                    count: String(items.length)
                });
            }
        }

        if (mediumConfidence.length > 0) {
            message += i18n.t('message.mediumConfidenceItems', { count: String(mediumConfidence.length) });
            const grouped = this.groupByType(mediumConfidence);
            for (const [type, items] of Object.entries(grouped)) {
                message += i18n.t('message.sensitiveDataTypeCount', {
                    type,
                    count: String(items.length)
                });
            }
        }

        if (lowConfidence.length > 0) {
            message += i18n.t('message.lowConfidenceItems', { count: String(lowConfidence.length) });
            const grouped = this.groupByType(lowConfidence);
            for (const [type, items] of Object.entries(grouped)) {
                message += i18n.t('message.sensitiveDataTypeCount', {
                    type,
                    count: String(items.length)
                });
            }
        }

        // Show dialog with options
        const maskAllSensitiveData = i18n.t('action.maskAllSensitiveData');
        const maskHighConfidenceOnly = i18n.t('action.maskHighConfidenceOnly');
        const reviewEachItem = i18n.t('action.reviewEachItem');
        const continueWithoutMasking = i18n.t('action.continueWithoutMasking');
        const cancelOperation = i18n.t('action.cancelOperation');

        const choice = await vscode.window.showWarningMessage(
            message,
            { modal: true },
            maskAllSensitiveData,
            maskHighConfidenceOnly,
            reviewEachItem,
            continueWithoutMasking,
            cancelOperation
        );

        switch (choice) {
            case maskAllSensitiveData:
                return { content: this.maskContent(content, matches, showPartial), masked: true };

            case maskHighConfidenceOnly:
                return { content: this.maskContent(content, highConfidence, showPartial), masked: true };

            case reviewEachItem:
                return await this.reviewEachItem(content, matches, showPartial);

            case continueWithoutMasking:
                const yesContinue = i18n.t('action.yesContinue');
                const noGoBack = i18n.t('action.noGoBack');
                const confirm = await vscode.window.showWarningMessage(
                    i18n.t('message.confirmCopySensitiveData'),
                    { modal: true },
                    yesContinue,
                    noGoBack
                );
                if (confirm === yesContinue) {
                    return { content, masked: false };
                }
                return this.promptUserForMasking(matches, content);

            case cancelOperation:
            default:
                throw new Error(USER_CANCELLED_ERROR_MESSAGE);
        }
    }

    private groupByType(matches: SensitiveDataMatch[]): Record<string, SensitiveDataMatch[]> {
        return matches.reduce((acc, match) => {
            if (!acc[match.type]) {
                acc[match.type] = [];
            }
            acc[match.type].push(match);
            return acc;
        }, {} as Record<string, SensitiveDataMatch[]>);
    }

    private async reviewEachItem(
        content: string,
        matches: SensitiveDataMatch[],
        showPartial: boolean
    ): Promise<{ content: string; masked: boolean }> {
        const i18n = I18nManager.getInstance();
        let resultContent = content;
        let anyMasked = false;

        // Sort matches by position (reverse order to not affect positions when replacing)
        const sortedMatches = [...matches].sort((a, b) => {
            if (a.line !== b.line) {
                return b.line - a.line;
            }
            return b.column - a.column;
        });

        const maskThis = i18n.t('action.maskThis');
        const keepOriginal = i18n.t('action.keepOriginal');
        const maskAllRemaining = i18n.t('action.maskAllRemaining');
        const cancel = i18n.t('action.cancel');

        for (const match of sortedMatches) {
            const preview = i18n.t('message.reviewSensitiveItem', {
                type: match.type,
                confidence: i18n.t(`confidence.${match.confidence}`),
                line: String(match.line),
                context: match.context ?? '',
                value: this.maskValue(match.value, showPartial)
            });

            const choice = await vscode.window.showInformationMessage(
                preview,
                { modal: true },
                maskThis,
                keepOriginal,
                maskAllRemaining,
                cancel
            );

            if (choice === maskThis) {
                resultContent = resultContent.replace(match.value, this.maskValue(match.value, showPartial));
                anyMasked = true;
            } else if (choice === maskAllRemaining) {
                const remaining = sortedMatches.slice(sortedMatches.indexOf(match));
                resultContent = this.maskContent(resultContent, remaining, showPartial);
                anyMasked = true;
                break;
            } else if (choice === cancel) {
                throw new Error(USER_CANCELLED_ERROR_MESSAGE);
            }
        }

        return { content: resultContent, masked: anyMasked };
    }

    private maskContent(content: string, matches: SensitiveDataMatch[], showPartial: boolean): string {
        let result = content;

        // Sort matches by position (reverse order)
        const sortedMatches = [...matches].sort((a, b) => {
            if (a.line !== b.line) {
                return b.line - a.line;
            }
            return b.column - a.column;
        });

        // Replace each match with masked version
        const replacedValues = new Set<string>();

        for (const match of sortedMatches) {
            if (!replacedValues.has(match.value)) {
                const masked = this.maskValue(match.value, showPartial);
                result = result.split(match.value).join(masked);
                replacedValues.add(match.value);
            }
        }

        return result;
    }
}
