import React, { useState } from 'react';
import {
  Compass, FolderTree, Play, History, BarChart2, ShieldCheck,
  ArrowRight, Lightbulb, Shuffle, CheckCircle, Lock, Eye,
  PlusCircle, Zap, ChevronRight, ChevronDown,
} from 'lucide-react';
import { NavTab } from '../types';
import { Lang } from '../i18n';

interface UserGuideViewProps {
  lang: Lang;
  onNavigateTab: (tab: NavTab) => void;
  onOpenStartTracking?: () => void;
}

// All guide content in both languages
const content = {
  en: {
    steps: [
      { id: 'WHERE_AM_I',     label: 'Where am I?' },
      { id: 'FIRST_JOURNEY',  label: 'Set up your work' },
      { id: 'FIRST_SESSION',  label: 'Start a session' },
      { id: 'DURING_SESSION', label: 'While working' },
      { id: 'AFTER_SESSION',  label: 'After a session' },
      { id: 'CONCEPTS',       label: 'Key concepts' },
    ],
    prev: '← Previous',
    next: 'Next →',
    done: 'Start working →',

    whereAmI: {
      title: "You're in Human Drift.",
      body: "This app tracks the gap between what you intended to do and what actually happened. It doesn't manage your tasks — it observes your work and preserves the record honestly.",
      quote: "You declare what you intend to do. You log what actually happens. The system preserves both — and the gap between them — without ever rewriting history.",
      navTitle: 'Five views in the app',
    },
    firstJourney: {
      title: 'Set up your work',
      body: 'Before you can log a session, you need a Thing context and at least one Thing inside it.',
      steps: [
        { title: 'Create a Thing context', body: 'A Thing context is the long-lived context — "R&D Work", "Learn Python", "IG Research". Use the Plan tab and the + button in the header to create one.' },
        { title: 'Add Things', body: 'Inside a Thing context, create Things — projects, tasks, or milestones. Tap + Add item in the Plan view. You can nest them as deep as you need.' },
        { title: 'Set an estimate (optional but valuable)', body: 'If you have a sense of how long a task should take, set an estimate. This is what Queries will compare against your actual time later.' },
      ],
      cta: 'Go to Plan',
    },
    firstTracking: {
      title: 'Starting a session',
      body: 'A session is a working period. You declare what you intend to do, then reality is logged against that declaration.',
      steps: [
        { title: 'Write your intention', body: 'Be specific. "Work on IG research" is weaker than "Find three competitor accounts and note their posting patterns." Your intention is locked the moment you start.' },
        { title: 'Set your starting condition', body: 'Energy, focus, location, environment — these stay at whatever you set until you change them. Be honest. Low energy is valid data.' },
        { title: 'Lock and begin', body: 'Tapping "Lock Plan & Start" commits the record. The session clock starts.' },
      ],
      tip: 'Tip: You can start a session from the Plan view by tapping the play icon next to any item.',
      cta: 'Start a session now',
    },
    duringTracking: {
      title: "While you're working",
      body: 'The Active Tracking screen is built for one-tap logging. Just tap what\'s happening.',
      actions: [
        { label: 'Start Task',       body: 'When you begin working on a specific node.' },
        { label: 'Complete Task',    body: 'When you finish. The node status updates automatically.' },
        { label: 'Switch Context',   body: 'When you stop one thing and start another without completing it.' },
        { label: 'Log Discovery',    body: "When something new surfaces that you didn't plan. Creates a new node and preserves where the idea came from." },
        { label: 'Revise Plan', body: 'When your focus genuinely shifts. The original Plan is preserved — this adds a revision record.' },
        { label: 'Change Condition', body: 'Tap any condition chip when it changes. It only updates if you tap it.' },
      ],
      gap: 'On gaps: Time between taps is recorded as an unclassified pause — not "wasted time". Just a gap. The system doesn\'t judge it.',
      cta: 'Go to Active Tracking',
    },
    afterTracking: {
      title: 'After a session',
      body: 'When you end a session, you add a reflection, and the data becomes available in History and Queries.',
      steps: [
        { title: 'Reflection + quality rating', body: 'Write a brief note on how the session went. Rate the session quality. These become part of the permanent record.' },
        { title: 'Check the History tab', body: 'Every session is stored chronologically. Drill into any session to see the full entry timeline — every tap, every condition, every gap.' },
        { title: 'Check the Queries tab', body: 'After a few sessions, Query 1 will show how your actual time compares to what you estimated. This is the core drift signal.' },
        { title: 'Corrections', body: 'If you spot a mistake in the history, you can correct it. The original is never deleted. Both versions are preserved.' },
      ],
    },
    concepts: {
      title: 'Key concepts',
      subtitle: 'Tap any term to expand it.',
      items: [
        { term: 'Thing context', body: 'A long-lived context that contains all your work in one domain. Trackings belong to exactly one Thing context.' },
        { term: 'Thing', body: 'Any unit of work — a project, a task, a milestone, or a note. Things live inside Thing contexts and can be nested freely.' },
        { term: 'Tracking', body: 'One working period with a declared intention. The intention is locked at the start.' },
        { term: 'Plan (preserved)', body: 'The commitment you make at the start of a session. It is written once and never changed. If your focus shifts, you log a Revision — the original stays in the record.' },
        { term: 'Condition', body: 'The circumstances at the moment of a tap: energy, focus, location, environment. Sticky — they carry forward until you change them.' },
        { term: 'Discovery', body: "When something new surfaces mid-session that you didn't plan for. It creates a new Thing and records the lineage." },
        { term: 'Drift', body: 'The gap between what was intended and what actually happened. Drift is information, not failure.' },
        { term: 'Unclassified Context Pause', body: 'Time between taps not attributed to any task. Recorded as a gap interval. The system records it; classification comes later.' },
        { term: 'Append-only audit log', body: 'Every data mutation produces an event record that is never modified or deleted. Corrections add — never overwrite.' },
      ],
    },
  },
  fa: {
    steps: [
      { id: 'WHERE_AM_I',     label: 'کجا هستم؟' },
      { id: 'FIRST_JOURNEY',  label: 'راه‌اندازی کار' },
      { id: 'FIRST_SESSION',  label: 'شروع جلسه' },
      { id: 'DURING_SESSION', label: 'هنگام کار' },
      { id: 'AFTER_SESSION',  label: 'بعد از جلسه' },
      { id: 'CONCEPTS',       label: 'مفاهیم کلیدی' },
    ],
    prev: '← قبلی',
    next: 'بعدی →',
    done: 'شروع کار →',

    whereAmI: {
      title: 'در Human Drift هستید.',
      body: 'این اپ شکاف بین آنچه قصد داشتید و آنچه واقعاً اتفاق افتاد را ردیابی می‌کند. کارهایتان را مدیریت نمی‌کند — فقط آن‌ها را صادقانه ثبت می‌کند.',
      quote: 'اعلام می‌کنید چه قصدی دارید. ثبت می‌کنید چه اتفاقی افتاد. سیستم هر دو را — و فاصله بینشان را — بدون هیچ بازنویسی حفظ می‌کند.',
      navTitle: 'پنج بخش اپ',
    },
    firstJourney: {
      title: 'راه‌اندازی کار',
      body: 'پیش از ثبت جلسه، به یک سفر و حداقل یک مورد داخل آن نیاز دارید.',
      steps: [
        { title: 'ایجاد سفر', body: 'سفر یک زمینه بلندمدت است — "کار تحقیقاتی"، "یادگیری Python". از بخش برنامه و دکمه + در هدر یک سفر بسازید.' },
        { title: 'افزودن موارد', body: 'داخل سفر، مواردی بسازید — پروژه‌ها، وظایف یا نقاط عطف. روی + افزودن در بخش برنامه بزنید. می‌توانید تو در تو کنید.' },
        { title: 'تخمین زمان (اختیاری ولی ارزشمند)', body: 'اگر ایده‌ای درباره مدت زمان کار دارید، تخمین بزنید. این همان چیزی است که بعداً با زمان واقعی مقایسه خواهد شد.' },
      ],
      cta: 'رفتن به برنامه',
    },
    firstTracking: {
      title: 'شروع جلسه',
      body: 'جلسه یک دوره کاری است. نیتتان را اعلام می‌کنید، سپس واقعیت در مقابل آن ثبت می‌شود.',
      steps: [
        { title: 'نیتتان را بنویسید', body: 'مشخص باشید. "روی تحقیق اینستاگرام کار می‌کنم" ضعیف‌تر از "سه حساب رقیب پیدا می‌کنم و الگوی پستشان را یادداشت می‌کنم" است. نیت از لحظه شروع قفل می‌شود.' },
        { title: 'شرایط اولیه را تنظیم کنید', body: 'انرژی، تمرکز، مکان، محیط — تا زمانی که تغییرشان ندهید همانطور می‌مانند. صادق باشید. انرژی پایین هم داده معتبر است.' },
        { title: 'قفل و شروع', body: 'با زدن "قفل کردن نیت و شروع"، ثبت انجام می‌شود و ساعت جلسه شروع می‌شود.' },
      ],
      tip: 'نکته: می‌توانید از بخش برنامه با زدن آیکون پخش کنار هر مورد، جلسه شروع کنید.',
      cta: 'شروع جلسه',
    },
    duringTracking: {
      title: 'هنگام کار',
      body: 'صفحه جلسه فعال برای ثبت با یک ضربه طراحی شده. فقط چیزی که اتفاق می‌افتد را بزنید.',
      actions: [
        { label: 'شروع وظیفه',       body: 'وقتی روی یک مورد شروع به کار می‌کنید.' },
        { label: 'تکمیل وظیفه',      body: 'وقتی تمام می‌کنید. وضعیت مورد خودکار به‌روز می‌شود.' },
        { label: 'تغییر زمینه',       body: 'وقتی یک کار را بدون تکمیل رها می‌کنید و چیز دیگری شروع می‌کنید.' },
        { label: 'ثبت کشف',          body: 'وقتی چیز جدید برنامه‌ریزی نشده‌ای پیدا می‌کنید. یک مورد جدید می‌سازد و منشأش را حفظ می‌کند.' },
        { label: 'تجدید نظر در نیت', body: 'وقتی تمرکزتان واقعاً تغییر می‌کند. نیت اصلی قفل می‌ماند — این فقط یک ثبت تجدیدنظر اضافه می‌کند.' },
        { label: 'تغییر شرایط',      body: 'روی هر چیپ شرایط بزنید وقتی تغییر می‌کند. فقط وقتی بزنید تغییر می‌کند.' },
      ],
      gap: 'درباره فاصله‌ها: زمان بین ضربه‌ها به عنوان توقف طبقه‌بندی نشده ثبت می‌شود — نه "وقت هدر رفته". فقط یک فاصله. سیستم قضاوت نمی‌کند.',
      cta: 'رفتن به جلسه فعال',
    },
    afterTracking: {
      title: 'بعد از جلسه',
      body: 'وقتی جلسه را پایان می‌دهید، تأمل می‌نویسید و داده در تاریخچه و پرس‌وجو در دسترس می‌شود.',
      steps: [
        { title: 'تأمل + امتیاز کیفی', body: 'یک یادداشت کوتاه درباره چگونگی جلسه بنویسید. این بخشی از سند دائمی می‌شود.' },
        { title: 'بررسی تاریخچه', body: 'هر جلسه به ترتیب زمانی ذخیره می‌شود. می‌توانید هر جلسه را باز کنید و کل جدول زمانی را ببینید.' },
        { title: 'بررسی پرس‌وجو', body: 'بعد از چند جلسه، پرس‌وجوی ۱ نشان می‌دهد زمان واقعی شما در هر مورد با تخمین شما چقدر فرق دارد. این سیگنال اصلی انحراف است.' },
        { title: 'اصلاحات', body: 'اگر اشتباهی در تاریخچه می‌بینید می‌توانید اصلاح کنید. اصلی هرگز حذف نمی‌شود. هر دو نسخه حفظ می‌شوند.' },
      ],
    },
    concepts: {
      title: 'مفاهیم کلیدی',
      subtitle: 'روی هر واژه بزنید تا باز شود.',
      items: [
        { term: 'سفر (Thing context)', body: 'زمینه‌ای بلندمدت که همه کارهای یک حوزه را در بر می‌گیرد. جلسات دقیقاً به یک سفر تعلق دارند.' },
        { term: 'مورد (Thing)', body: 'هر واحد کاری — پروژه، وظیفه، نقطه عطف یا یادداشت. داخل سفرها قرار می‌گیرند و می‌توانند تو در تو باشند.' },
        { term: 'جلسه (Tracking)', body: 'یک دوره کاری با نیت اعلام‌شده. نیت از ابتدا قفل می‌شود.' },
        { term: 'نیت (غیرقابل تغییر)', body: 'تعهدی که در ابتدای جلسه می‌دهید. یک بار نوشته می‌شود و هرگز تغییر نمی‌کند. اگر تمرکزتان عوض شد، تجدیدنظر ثبت می‌کنید — اصلی می‌ماند.' },
        { term: 'شرایط (Condition)', body: 'اوضاع لحظه ضربه: انرژی، تمرکز، مکان، محیط. چسبنده است — تا تغییرش ندهید همانطور می‌ماند.' },
        { term: 'کشف (Discovery)', body: 'وقتی در میان جلسه چیز برنامه‌ریزی نشده‌ای ظاهر می‌شود. یک مورد جدید می‌سازد و ریشه‌اش را حفظ می‌کند.' },
        { term: 'انحراف (Drift)', body: 'فاصله بین آنچه قصد داشتید و آنچه واقعاً اتفاق افتاد. انحراف اطلاعات است، نه شکست.' },
        { term: 'توقف طبقه‌بندی نشده', body: 'زمان بین ضربه‌ها که به هیچ وظیفه‌ای نسبت داده نشده. سیستم آن را ثبت می‌کند؛ طبقه‌بندی بعداً می‌آید.' },
        { term: 'گزارش حسابرسی', body: 'هر تغییر داده یک رویداد ایجاد می‌کند که هرگز تغییر یا حذف نمی‌شود. اصلاحات اضافه می‌کنند — هرگز بازنویسی نمی‌کنند.' },
      ],
    },
  },
} as const;

type StepId = 'WHERE_AM_I' | 'FIRST_JOURNEY' | 'FIRST_SESSION' | 'DURING_SESSION' | 'AFTER_SESSION' | 'CONCEPTS';

interface ConceptProps { term: string; body: string }
const Concept: React.FC<ConceptProps> = ({ term, body }) => {
  const [open, setOpen] = useState(false);
  return (
    <button onClick={() => setOpen(!open)} className="w-full text-left p-3.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 transition-colors cursor-pointer">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-stone-900">{term}</span>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />}
      </div>
      {open && <p className="text-xs text-stone-600 leading-relaxed mt-2 pt-2 border-t border-stone-200">{body}</p>}
    </button>
  );
};

interface NavCardProps { icon: React.ReactNode; label: string; description: string; tab: NavTab; onNavigate: (tab: NavTab) => void }
const NavCard: React.FC<NavCardProps> = ({ icon, label, description, tab, onNavigate }) => (
  <button onClick={() => onNavigate(tab)} className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 bg-white hover:border-stone-400 transition-all text-left w-full cursor-pointer group">
    <div className="p-2 rounded-lg bg-stone-100 text-stone-700 group-hover:bg-stone-900 group-hover:text-white transition-colors shrink-0">{icon}</div>
    <div className="min-w-0">
      <div className="text-xs font-semibold text-stone-900">{label}</div>
      <div className="text-2xs text-stone-500 truncate">{description}</div>
    </div>
    <ArrowRight className="w-3.5 h-3.5 text-stone-400 shrink-0 ml-auto" />
  </button>
);

const actionIcons = [
  <Play className="w-3.5 h-3.5" />,
  <CheckCircle className="w-3.5 h-3.5" />,
  <Shuffle className="w-3.5 h-3.5" />,
  <Lightbulb className="w-3.5 h-3.5" />,
  <Lock className="w-3.5 h-3.5" />,
  <Eye className="w-3.5 h-3.5" />,
];

export const UserGuideView: React.FC<UserGuideViewProps> = ({ lang, onNavigateTab, onOpenStartTracking }) => {
  const [step, setStep] = useState<StepId>('WHERE_AM_I');
  const c = content[lang];
  const steps = c.steps;
  const currentIndex = steps.findIndex(s => s.id === step);

  const navLabels: Record<NavTab, string> = {
    ASK:       lang === 'fa' ? 'چت پرسش' : 'Ask',
    LOG:       lang === 'fa' ? 'چت لاگ' : 'Log',
    QUERY:     lang === 'fa' ? 'چت پرسش' : 'Ask',
    TASKS:     lang === 'fa' ? 'وظایف' : 'Things',
    DRIFT:     lang === 'fa' ? 'دریفت' : 'Drift',
    BOARD:     lang === 'fa' ? 'بُرد' : 'Board',
    FAST_LOG:  lang === 'fa' ? 'ثبت سریع' : 'Quick Log',
    GUIDE:     lang === 'fa' ? 'راهنما' : 'Guide',
    HIERARCHY: lang === 'fa' ? 'برنامه' : 'Plan',
    SESSION:   lang === 'fa' ? 'جلسه'  : 'Tracking',
    HISTORY:   lang === 'fa' ? 'تاریخچه' : 'History',
    QUERIES:   lang === 'fa' ? 'پرس‌وجو' : 'Queries',
    AUDIT:     lang === 'fa' ? 'گزارش' : 'Audit',
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-16">

      {/* Header */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-stone-900 text-white rounded-xl"><Compass className="w-4 h-4" /></div>
          <div>
            <h2 className="text-sm font-bold text-stone-900">Human Drift</h2>
            <p className="text-2xs text-stone-500">{lang === 'fa' ? 'راهنما' : 'Guide'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {steps.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStep(s.id as StepId)}
              className={`px-3 py-1.5 rounded-lg text-2xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                step === s.id ? 'bg-stone-900 text-white' : i < currentIndex ? 'bg-stone-100 text-stone-500 hover:bg-stone-200' : 'bg-stone-50 text-stone-400 hover:bg-stone-100 hover:text-stone-600'
              }`}
            >
              {i < currentIndex && <CheckCircle className="w-3 h-3 inline mr-1 text-stone-400" />}
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">

        {step === 'WHERE_AM_I' && (() => { const d = c.whereAmI; return (<>
          <div>
            <h3 className="text-base font-bold text-stone-900 mb-1">{d.title}</h3>
            <p className="text-xs text-stone-600 leading-relaxed">{d.body}</p>
          </div>
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-700 italic leading-relaxed">"{d.quote}"</div>
          <div className="space-y-2">
            <p className="text-2xs font-semibold text-stone-500">{d.navTitle}</p>
            <div className="grid grid-cols-1 gap-2">
              <NavCard icon={<FolderTree className="w-3.5 h-3.5" />} label={navLabels.HIERARCHY} description={lang === 'fa' ? 'پروژه‌ها و وظایف شما — برنامه' : 'Your projects and tasks — the plan'} tab="HIERARCHY" onNavigate={onNavigateTab} />
              <NavCard icon={<Play className="w-3.5 h-3.5" />} label={navLabels.SESSION} description={lang === 'fa' ? 'ثبت آنچه الان اتفاق می‌افتد' : 'Log what is happening right now'} tab="SESSION" onNavigate={onNavigateTab} />
              <NavCard icon={<History className="w-3.5 h-3.5" />} label={navLabels.HISTORY} description={lang === 'fa' ? 'هر جلسه گذشته، با زمان‌بندی' : 'Every past session, timestamped'} tab="HISTORY" onNavigate={onNavigateTab} />
              <NavCard icon={<BarChart2 className="w-3.5 h-3.5" />} label={navLabels.QUERIES} description={lang === 'fa' ? 'زمان واقعی در مقابل تخمین، پیشرفت' : 'Actual vs estimated time, progress'} tab="QUERIES" onNavigate={onNavigateTab} />
              <NavCard icon={<ShieldCheck className="w-3.5 h-3.5" />} label={navLabels.AUDIT} description={lang === 'fa' ? 'هر تغییر، فقط الحاق' : 'Every mutation, append-only'} tab="AUDIT" onNavigate={onNavigateTab} />
            </div>
          </div>
        </>); })()}

        {step === 'FIRST_JOURNEY' && (() => { const d = c.firstJourney; return (<>
          <div><h3 className="text-base font-bold text-stone-900 mb-1">{d.title}</h3><p className="text-xs text-stone-600 leading-relaxed">{d.body}</p></div>
          <div className="space-y-3">
            {d.steps.map((s, i) => (
              <div key={i} className="flex gap-3 items-start p-3.5 rounded-xl border border-stone-200 bg-stone-50">
                <div className="w-6 h-6 rounded-full bg-stone-900 text-white text-2xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i+1}</div>
                <div><p className="text-xs font-semibold text-stone-900">{s.title}</p><p className="text-2xs text-stone-600 mt-0.5 leading-relaxed">{s.body}</p></div>
              </div>
            ))}
          </div>
          <button onClick={() => onNavigateTab('HIERARCHY')} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer">
            <FolderTree className="w-3.5 h-3.5" /><span>{d.cta}</span>
          </button>
        </>); })()}

        {step === 'FIRST_SESSION' && (() => { const d = c.firstTracking; return (<>
          <div><h3 className="text-base font-bold text-stone-900 mb-1">{d.title}</h3><p className="text-xs text-stone-600 leading-relaxed">{d.body}</p></div>
          <div className="space-y-3">
            {d.steps.map((s, i) => (
              <div key={i} className="flex gap-3 items-start p-3.5 rounded-xl border border-stone-200 bg-stone-50">
                {[<Lock />, <Zap />, <Play />][i] && <div className="w-4 h-4 text-stone-600 shrink-0 mt-0.5">{[<Lock className="w-4 h-4" />, <Zap className="w-4 h-4" />, <Play className="w-4 h-4" />][i]}</div>}
                <div><p className="text-xs font-semibold text-stone-900">{s.title}</p><p className="text-2xs text-stone-600 mt-0.5 leading-relaxed">{s.body}</p></div>
              </div>
            ))}
          </div>
          <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 text-2xs text-stone-600 leading-relaxed">{d.tip}</div>
          <button onClick={() => { if (onOpenStartTracking) onOpenStartTracking(); else onNavigateTab('SESSION'); }} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer">
            <Play className="w-3.5 h-3.5 fill-current" /><span>{d.cta}</span>
          </button>
        </>); })()}

        {step === 'DURING_SESSION' && (() => { const d = c.duringTracking; return (<>
          <div><h3 className="text-base font-bold text-stone-900 mb-1">{d.title}</h3><p className="text-xs text-stone-600 leading-relaxed">{d.body}</p></div>
          <div className="space-y-2">
            {d.actions.map((a, i) => (
              <div key={i} className="flex gap-3 items-start p-3 rounded-xl border border-stone-200 bg-stone-50">
                <div className="p-1.5 rounded-lg bg-white border border-stone-200 text-stone-600 shrink-0">{actionIcons[i]}</div>
                <div><p className="text-xs font-semibold text-stone-900">{a.label}</p><p className="text-2xs text-stone-600 leading-relaxed">{a.body}</p></div>
              </div>
            ))}
          </div>
          <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 text-2xs text-stone-600 leading-relaxed">{d.gap}</div>
          <button onClick={() => onNavigateTab('SESSION')} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer">
            <Play className="w-3.5 h-3.5" /><span>{d.cta}</span>
          </button>
        </>); })()}

        {step === 'AFTER_SESSION' && (() => { const d = c.afterTracking; return (<>
          <div><h3 className="text-base font-bold text-stone-900 mb-1">{d.title}</h3><p className="text-xs text-stone-600 leading-relaxed">{d.body}</p></div>
          <div className="space-y-3">
            {d.steps.map((s, i) => (
              <div key={i} className="flex gap-3 items-start p-3.5 rounded-xl border border-stone-200 bg-stone-50">
                <div className="w-4 h-4 text-stone-600 shrink-0 mt-0.5">{[<PlusCircle className="w-4 h-4" />, <History className="w-4 h-4" />, <BarChart2 className="w-4 h-4" />, <Eye className="w-4 h-4" />][i]}</div>
                <div><p className="text-xs font-semibold text-stone-900">{s.title}</p><p className="text-2xs text-stone-600 mt-0.5 leading-relaxed">{s.body}</p></div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onNavigateTab('HISTORY')} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold cursor-pointer"><History className="w-3.5 h-3.5" /><span>{navLabels.HISTORY}</span></button>
            <button onClick={() => onNavigateTab('QUERIES')} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold cursor-pointer"><BarChart2 className="w-3.5 h-3.5" /><span>{navLabels.QUERIES}</span></button>
          </div>
        </>); })()}

        {step === 'CONCEPTS' && (() => { const d = c.concepts; return (<>
          <div><h3 className="text-base font-bold text-stone-900 mb-1">{d.title}</h3><p className="text-xs text-stone-600 mb-3">{d.subtitle}</p></div>
          <div className="space-y-2">{d.items.map((item, i) => <Concept key={i} term={item.term} body={item.body} />)}</div>
        </>); })()}
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => setStep(steps[currentIndex - 1]?.id as StepId)} disabled={currentIndex === 0} className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
          {c.prev}
        </button>
        <span className="text-2xs text-stone-400">{currentIndex + 1} / {steps.length}</span>
        {currentIndex < steps.length - 1 ? (
          <button onClick={() => setStep(steps[currentIndex + 1]?.id as StepId)} className="px-4 py-2 text-xs font-semibold text-stone-900 cursor-pointer">{c.next}</button>
        ) : (
          <button onClick={() => onNavigateTab('HIERARCHY')} className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-semibold cursor-pointer">{c.done}</button>
        )}
      </div>
    </div>
  );
};
