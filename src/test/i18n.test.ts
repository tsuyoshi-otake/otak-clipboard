import * as assert from 'assert';
import { I18nManager } from '../i18n/I18nManager';

suite('I18n Test Suite', () => {
    test('resolves Japanese locale variants', () => {
        const i18n = I18nManager.getInstance();
        i18n.initialize('ja-JP');

        assert.strictEqual(i18n.getCurrentLocale(), 'ja');
        assert.strictEqual(i18n.t('command.copyCurrentTab'), '現在のタブをコピー');
    });

    test('resolves traditional Chinese locale variants', () => {
        const i18n = I18nManager.getInstance();
        i18n.initialize('zh-Hant-TW');

        assert.strictEqual(i18n.getCurrentLocale(), 'zh-tw');
        assert.strictEqual(i18n.t('command.copyFile'), '複製檔案');
    });

    test('falls back to English for unsupported locales', () => {
        const i18n = I18nManager.getInstance();
        i18n.initialize('fr-FR');

        assert.strictEqual(i18n.getCurrentLocale(), 'en');
        assert.strictEqual(i18n.t('command.copyFolder'), 'Copy Folder Contents');
    });

    test('substitutes message parameters', () => {
        const i18n = I18nManager.getInstance();
        i18n.initialize('en');

        assert.strictEqual(
            i18n.t('error.tooManyFiles', { limit: '400' }),
            'Too many files selected. Maximum limit is 400 files.\nPlease reduce the selection and try again.'
        );
    });
});
