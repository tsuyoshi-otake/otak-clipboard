export type SupportedLocale = 'en' | 'ja' | 'zh-cn' | 'zh-tw' | 'ko' | 'vi';

export interface TranslationMessages {
    [key: string]: string;
}

export interface I18nConfig {
    defaultLocale: SupportedLocale;
    supportedLocales: SupportedLocale[];
    fallbackLocale: SupportedLocale;
}
