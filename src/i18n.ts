// Human Drift — i18n
// Two languages: English (en) and Persian/Farsi (fa)
// RTL layout is toggled via the `dir` attribute on <html> when fa is active.
// Add new keys here. Both languages must have every key.

export type Lang = 'en' | 'fa';

export const strings = {
  en: {
    // App shell
    appName: 'Your workspace',
    loading: 'Loading…',
    noJourneySelected: 'No journey selected',

    // Nav tabs
    board: 'Board',
    fastLog: 'Quick Log',
    guide: 'Guide',
    tree: 'Plan',
    session: 'Session',
    history: 'History',
    queries: 'Queries',
    audit: 'Audit',

    // Header
    startSession: 'Start Tracking',
    activeSession: 'Active',
    newJourney: 'New Thing',
    switchJourney: 'Switch Thing context',

    // Thing context / node tree
    journeyStarted: 'Started',
    addNode: 'Add item',
    noNodes: 'Nothing here yet',
    noNodesHint: 'Add your first project or task to get started.',
    startSessionHere: 'Start Tracking on this Thing',

    // Thing context create modal
    createJourney: 'New Thing',
    journeyNameLabel: 'Thing context name',
    journeyNamePlaceholder: 'e.g. R&D Work, Learn Python',
    journeyDescLabel: 'Description (optional)',
    journeyDescPlaceholder: 'What is the overarching intention?',
    cancel: 'Cancel',
    create: 'Create',

    // First run
    firstRunTitle: 'What are you working on?',
    firstRunSubtitle: 'Start with the most immediate thing. You can add more later.',
    firstRunJourneyLabel: 'Name this context',
    firstRunJourneyPlaceholder: 'e.g. R&D Work, Learn Python, IG Research',
    firstRunJourneyHint: 'This becomes your Thing context — the long-lived container for related work.',
    firstRunNodeLabel: 'First thing to work on',
    firstRunNodePlaceholder: 'e.g. Research competitors, Write domain model',
    firstRunNodeHint: 'You can break this into subtasks once inside.',
    firstRunTypeLabel: 'Type',
    begin: 'Begin',
    initializing: 'Setting up…',
    errorBothRequired: 'Give your journey a name and something to work on.',

    // Session empty state
    noActiveSession: 'No active session',
    noActiveSessionHint: 'Declare your intention and start a working period.',
    lockAndStart: 'Lock Intention & Start',

    // Language
    language: 'Language',
    langEn: 'English',
    langFa: 'فارسی',
  },

  fa: {
    // App shell
    appName: 'Your workspace',
    loading: 'در حال بارگذاری…',
    noJourneySelected: 'سفری انتخاب نشده',

    // Nav tabs
    board: 'بُرد',
    fastLog: 'ثبت سریع',
    guide: 'راهنما',
    tree: 'برنامه',
    session: 'جلسه',
    history: 'تاریخچه',
    queries: 'پرس‌وجو',
    audit: 'گزارش',

    // Header
    startSession: 'شروع جلسه',
    activeSession: 'جلسه فعال',
    newJourney: 'سفر جدید',
    switchJourney: 'تغییر سفر',

    // Thing context / node tree
    journeyStarted: 'شروع',
    addNode: 'افزودن',
    noNodes: 'هنوز چیزی نیست',
    noNodesHint: 'اولین پروژه یا وظیفه خود را اضافه کنید.',
    startSessionHere: 'شروع جلسه روی این مورد',

    // Thing context create modal
    createJourney: 'سفر جدید',
    journeyNameLabel: 'نام سفر',
    journeyNamePlaceholder: 'مثلاً: کار تحقیقاتی، یادگیری Python',
    journeyDescLabel: 'توضیح (اختیاری)',
    journeyDescPlaceholder: 'هدف کلی چیست؟',
    cancel: 'انصراف',
    create: 'ایجاد',

    // First run
    firstRunTitle: 'روی چه چیزی کار می‌کنید؟',
    firstRunSubtitle: 'با فوری‌ترین کار شروع کنید. بعداً می‌توانید موارد دیگر اضافه کنید.',
    firstRunJourneyLabel: 'نام این زمینه',
    firstRunJourneyPlaceholder: 'مثلاً: تحقیق اینستاگرام، یادگیری پایتون',
    firstRunJourneyHint: 'این سفر شما می‌شود — ظرف بلندمدت برای کارهای مرتبط.',
    firstRunNodeLabel: 'اولین کاری که می‌خواهید انجام دهید',
    firstRunNodePlaceholder: 'مثلاً: تحقیق درباره رقبا، نوشتن مدل دامنه',
    firstRunNodeHint: 'بعد از ورود می‌توانید این را به وظایف کوچک‌تر تقسیم کنید.',
    firstRunTypeLabel: 'نوع',
    begin: 'شروع',
    initializing: 'در حال راه‌اندازی…',
    errorBothRequired: 'نام سفر و اولین کار را وارد کنید.',

    // Session empty state
    noActiveSession: 'جلسه‌ای فعال نیست',
    noActiveSessionHint: 'نیت خود را اعلام کنید و یک دوره کاری شروع کنید.',
    lockAndStart: 'قفل کردن نیت و شروع',

    // Language
    language: 'زبان',
    langEn: 'English',
    langFa: 'فارسی',
  },
} as const;

export type StringKey = keyof typeof strings.en;

export function t(lang: Lang, key: StringKey): string {
  return strings[lang][key] ?? strings.en[key] ?? key;
}

export const RTL_LANGS: Lang[] = ['fa'];

export function isRTL(lang: Lang): boolean {
  return RTL_LANGS.includes(lang);
}
