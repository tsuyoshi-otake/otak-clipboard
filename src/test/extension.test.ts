import * as assert from 'assert';
import { ClipboardUtils } from '../utils/ClipboardUtils';
import { ContentBudget, LimitExceededError } from '../utils/LimitChecker';
import { SensitiveDataDetector } from '../utils/SensitiveDataDetector';

suite('Extension Test Suite', () => {
    test('content budget rejects file count before collection grows', () => {
        const budget = new ContentBudget({ maxCharacters: 20, maxFiles: 2 });

        budget.addFile();
        budget.addFile();

        assert.throws(
            () => budget.addFile(),
            (error: unknown) => error instanceof LimitExceededError && error.kind === 'files'
        );
    });

    test('content budget rejects character count without joining all files', () => {
        const budget = new ContentBudget({ maxCharacters: 8, maxFiles: 10 });

        budget.addContent('1234');

        assert.throws(
            () => budget.addContent('56789'),
            (error: unknown) => error instanceof LimitExceededError && error.kind === 'characters'
        );
    });

    test('markdown formatter expands fences when file content contains triple backticks', () => {
        const clipboardUtils = new ClipboardUtils();
        const markdown = clipboardUtils.convertToMarkdown([{
            path: 'example.ts',
            content: 'const value = "```";',
            isBinary: false
        }]);

        assert.ok(markdown.includes('````ts'));
        assert.ok(markdown.includes('const value = "```";'));
    });

    test('sensitive data detection treats Windows test paths as lower confidence', async () => {
        const detector = new SensitiveDataDetector();
        const matches = await detector.detectSensitiveData(
            'const token = "ghp_aB3dE5gH7jK9mN2pQ4rS6tU8vW0xY1zA2bC3";',
            'C:\\repo\\tests\\token.test.ts'
        );
        const githubMatch = matches.find(match => match.type === 'GitHub Personal Access Token');

        assert.ok(githubMatch);
        assert.strictEqual(githubMatch.confidence, 'medium');
    });
});
