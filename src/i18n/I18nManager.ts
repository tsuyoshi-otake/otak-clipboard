import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { I18nConfig, SupportedLocale, TranslationMessages } from './types';

export class I18nManager {
    private static instance: I18nManager;
    private readonly config: I18nConfig;
    private currentLocale: SupportedLocale;
    private messages: TranslationMessages = {};
    private fallbackMessages: TranslationMessages = {};
    private initialized = false;

    private constructor() {
        this.config = {
            defaultLocale: 'en',
            supportedLocales: ['en', 'ja', 'zh-cn', 'zh-tw', 'ko', 'vi'],
            fallbackLocale: 'en'
        };
        this.currentLocale = this.config.defaultLocale;
    }

    public static getInstance(): I18nManager {
        if (!I18nManager.instance) {
            I18nManager.instance = new I18nManager();
        }

        return I18nManager.instance;
    }

    public initialize(locale?: string): void {
        const normalizedLocale = this.normalizeLocale(locale || vscode.env.language);
        this.currentLocale = this.resolveSupportedLocale(normalizedLocale) ?? this.config.fallbackLocale;
        this.loadTranslations();
        this.initialized = true;
    }

    public t(key: string, params?: Record<string, string>): string {
        if (!this.initialized) {
            this.initialize();
        }

        const message = this.messages[key] ?? this.fallbackMessages[key] ?? `[missing: ${key}]`;

        if (!params) {
            return message;
        }

        return this.substituteParams(message, params);
    }

    public getCurrentLocale(): SupportedLocale {
        return this.currentLocale;
    }

    private normalizeLocale(locale: string): string {
        return (locale || '').trim().replace(/_/g, '-').toLowerCase();
    }

    private resolveSupportedLocale(locale: string): SupportedLocale | null {
        if (this.isSupportedLocale(locale)) {
            return locale as SupportedLocale;
        }

        const baseLocale = locale.split('-')[0];
        if (this.isSupportedLocale(baseLocale)) {
            return baseLocale as SupportedLocale;
        }

        if (baseLocale === 'zh') {
            const isTraditional = locale.includes('hant') ||
                locale.includes('tw') ||
                locale.includes('hk') ||
                locale.includes('mo');
            return isTraditional ? 'zh-tw' : 'zh-cn';
        }

        return null;
    }

    private isSupportedLocale(locale: string): boolean {
        return this.config.supportedLocales.includes(locale as SupportedLocale);
    }

    private loadTranslations(): void {
        try {
            this.messages = this.loadLocaleFile(this.currentLocale);
            this.fallbackMessages = this.currentLocale === this.config.fallbackLocale
                ? this.messages
                : this.loadLocaleFile(this.config.fallbackLocale);
        } catch (error) {
            this.currentLocale = this.config.fallbackLocale;
            this.messages = this.loadLocaleFile(this.config.fallbackLocale);
            this.fallbackMessages = this.messages;
        }
    }

    private loadLocaleFile(locale: SupportedLocale): TranslationMessages {
        const localeFilePath = path.join(__dirname, 'locales', `${locale}.json`);
        const fileContent = fs.readFileSync(localeFilePath, 'utf-8');
        return JSON.parse(fileContent) as TranslationMessages;
    }

    private substituteParams(message: string, params: Record<string, string>): string {
        let result = message;

        for (const [key, value] of Object.entries(params)) {
            const placeholder = `{${key}}`;
            const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            result = result.replace(new RegExp(escapedPlaceholder, 'g'), value);
        }

        return result;
    }
}
