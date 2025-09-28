import * as vscode from 'vscode';

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

export class SensitiveDataDetector {
    private patterns: Map<string, { regex: RegExp; confidence: 'high' | 'medium' | 'low' }>;

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

        // Skip detection for certain file types
        const skipExtensions = ['.md', '.txt', '.log', '.lock'];
        if (skipExtensions.some(ext => filePath.endsWith(ext))) {
            return matches;
        }

        // Check if it's likely a test/example file
        const isTestFile = /\.(test|spec|example|sample)\./i.test(filePath) ||
                          filePath.includes('/test/') ||
                          filePath.includes('/tests/') ||
                          filePath.includes('/examples/');

        lines.forEach((line, lineIndex) => {
            // Skip comments (basic implementation - could be improved)
            const isComment = line.trim().startsWith('//') ||
                            line.trim().startsWith('#') ||
                            line.trim().startsWith('*') ||
                            line.trim().startsWith('<!--');

            this.patterns.forEach((patternInfo, type) => {
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

        // Group matches by confidence
        const highConfidence = matches.filter(m => m.confidence === 'high');
        const mediumConfidence = matches.filter(m => m.confidence === 'medium');
        const lowConfidence = matches.filter(m => m.confidence === 'low');

        // Build message
        let message = `⚠️ Detected ${matches.length} potential sensitive data items:\n\n`;

        if (highConfidence.length > 0) {
            message += `🔴 High confidence (${highConfidence.length} items):\n`;
            const grouped = this.groupByType(highConfidence);
            for (const [type, items] of Object.entries(grouped)) {
                message += `  • ${type}: ${items.length} occurrence(s)\n`;
            }
        }

        if (mediumConfidence.length > 0) {
            message += `\n🟡 Medium confidence (${mediumConfidence.length} items):\n`;
            const grouped = this.groupByType(mediumConfidence);
            for (const [type, items] of Object.entries(grouped)) {
                message += `  • ${type}: ${items.length} occurrence(s)\n`;
            }
        }

        if (lowConfidence.length > 0) {
            message += `\n⚪ Low confidence (${lowConfidence.length} items):\n`;
            const grouped = this.groupByType(lowConfidence);
            for (const [type, items] of Object.entries(grouped)) {
                message += `  • ${type}: ${items.length} occurrence(s)\n`;
            }
        }

        // Show dialog with options
        const options = [
            'Mask All Sensitive Data',
            'Mask High Confidence Only',
            'Review Each Item',
            'Continue Without Masking',
            'Cancel Operation'
        ];

        const choice = await vscode.window.showWarningMessage(
            message,
            { modal: true },
            ...options
        );

        switch (choice) {
            case 'Mask All Sensitive Data':
                return { content: this.maskContent(content, matches), masked: true };

            case 'Mask High Confidence Only':
                return { content: this.maskContent(content, highConfidence), masked: true };

            case 'Review Each Item':
                return await this.reviewEachItem(content, matches);

            case 'Continue Without Masking':
                const confirm = await vscode.window.showWarningMessage(
                    '⚠️ Are you sure you want to copy potentially sensitive data without masking?',
                    { modal: true },
                    'Yes, Continue',
                    'No, Go Back'
                );
                if (confirm === 'Yes, Continue') {
                    return { content, masked: false };
                }
                return this.promptUserForMasking(matches, content);

            case 'Cancel Operation':
            default:
                throw new Error('Operation cancelled by user');
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

    private async reviewEachItem(content: string, matches: SensitiveDataMatch[]): Promise<{ content: string; masked: boolean }> {
        let resultContent = content;
        let anyMasked = false;

        // Sort matches by position (reverse order to not affect positions when replacing)
        const sortedMatches = [...matches].sort((a, b) => {
            if (a.line !== b.line) return b.line - a.line;
            return b.column - a.column;
        });

        for (const match of sortedMatches) {
            const preview = `${match.type} (${match.confidence} confidence)\nLine ${match.line}: ${match.context}\nValue: ${this.maskValue(match.value)}`;

            const choice = await vscode.window.showInformationMessage(
                preview,
                { modal: true },
                'Mask This',
                'Keep Original',
                'Mask All Remaining',
                'Cancel'
            );

            if (choice === 'Mask This') {
                resultContent = resultContent.replace(match.value, this.maskValue(match.value));
                anyMasked = true;
            } else if (choice === 'Mask All Remaining') {
                const remaining = sortedMatches.slice(sortedMatches.indexOf(match));
                resultContent = this.maskContent(resultContent, remaining);
                anyMasked = true;
                break;
            } else if (choice === 'Cancel') {
                throw new Error('Operation cancelled by user');
            }
        }

        return { content: resultContent, masked: anyMasked };
    }

    private maskContent(content: string, matches: SensitiveDataMatch[]): string {
        let result = content;

        // Sort matches by position (reverse order)
        const sortedMatches = [...matches].sort((a, b) => {
            if (a.line !== b.line) return b.line - a.line;
            return b.column - a.column;
        });

        // Replace each match with masked version
        const replacedValues = new Set<string>();

        for (const match of sortedMatches) {
            if (!replacedValues.has(match.value)) {
                const masked = this.maskValue(match.value);
                result = result.split(match.value).join(masked);
                replacedValues.add(match.value);
            }
        }

        return result;
    }
}