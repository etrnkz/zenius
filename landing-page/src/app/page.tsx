'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import {
  FileText, Layers, BrainCircuit, Headphones,
  MessageSquare, Youtube, Download, ArrowUpRight,
  CheckCircle2, Menu, X, MoveRight,
} from 'lucide-react';

// Load GLSLHills client-side only (WebGL needs browser)
const GLSLHills = dynamic(
  () => import('@/components/ui/glsl-hills').then(m => m.GLSLHills),
  { ssr: false }
);

/* ── scroll-triggered visibility ── */
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

const FEATURES = [
  { Icon: FileText,      title: 'Smart Notes',    desc: 'PDFs, DOCX, PPTX → clean exam-ready notes in seconds.' },
  { Icon: Layers,        title: 'Flashcards',      desc: 'Every concept auto-converted. Spaced repetition built in.' },
  { Icon: BrainCircuit,  title: 'AI Quiz Engine',  desc: 'Multiple-choice quizzes generated from any material.' },
  { Icon: Headphones,    title: 'Study Podcasts',  desc: 'Your notes as audio. Listen anywhere, anytime.' },
  { Icon: MessageSquare, title: 'AI Tutor Chat',   desc: 'Ask anything. The AI has full context of your notes.' },
  { Icon: Youtube,       title: 'YouTube & Audio', desc: 'Paste a link or upload audio. Zenius handles the rest.' },
];

/* ════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [scrolled, setScrolled]       = useState(false);
  const [menuOpen, setMenuOpen]       = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function handleDownload() {
    setDownloading(true);
    const a = document.createElement('a');
    a.href = '/zenius.apk';
    a.download = 'Zenius.apk';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setDownloading(false), 2500);
  }

  const featRef = useInView();
  const ctaRef  = useInView();

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden selection:bg-white selection:text-black font-sans">

      {/* ════════════════ NAV ════════════════ */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled ? 'bg-[#080808]/90 backdrop-blur-2xl border-b border-white/[0.07]' : ''
      }`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

          {/* logo — always white/inverted so it's visible on dark bg */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative w-7 h-5 overflow-hidden">
              <Image
                src="/logo.svg"
                alt="Zenius"
                fill
                className="object-contain brightness-0 invert"
              />
            </div>
            <span className="font-bold text-base tracking-tight text-white">Zenius</span>
          </Link>

          {/* desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {['Features', 'How it works', 'Download'].map(label => (
              <a
                key={label}
                href={`#${label.toLowerCase().replace(/ /g, '-')}`}
                className="px-4 py-2 text-sm text-zinc-500 hover:text-white rounded-lg hover:bg-white/5 transition-all duration-150"
              >
                {label}
              </a>
            ))}
          </div>

          {/* desktop ctas */}
          <div className="hidden md:flex items-center gap-2">
            <a href="https://your-app-url.com" className="px-4 py-2 text-sm text-zinc-500 hover:text-white transition-colors">
              Open App
            </a>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-semibold rounded-xl hover:bg-zinc-100 transition-all duration-150 hover:shadow-[0_0_30px_rgba(255,255,255,0.15)] active:scale-95"
            >
              <Download size={14} />
              Download APK
            </button>
          </div>

          {/* mobile toggle */}
          <button className="md:hidden p-2 text-zinc-400 hover:text-white" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/[0.07] bg-[#080808] px-6 py-5 flex flex-col gap-3">
            {['Features', 'How it works', 'Download'].map(label => (
              <a
                key={label}
                href={`#${label.toLowerCase().replace(/ /g, '-')}`}
                onClick={() => setMenuOpen(false)}
                className="text-sm text-zinc-400 hover:text-white py-1 transition-colors"
              >
                {label}
              </a>
            ))}
            <div className="flex gap-2 pt-3 border-t border-white/[0.07]">
              <a href="https://your-app-url.com" className="flex-1 text-center text-sm border border-white/10 text-zinc-300 px-4 py-2.5 rounded-xl">Open App</a>
              <button onClick={handleDownload} className="flex-1 text-sm bg-white text-black font-semibold px-4 py-2.5 rounded-xl">Download</button>
            </div>
          </div>
        )}
      </nav>

      {/* ════════════════ HERO ════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden text-center">

        {/* GLSL hills — full-screen background */}
        <div className="absolute inset-0 z-0">
          <GLSLHills width="100%" height="100%" speed={0.5} />
        </div>

        {/* dark overlay so text stays readable */}
        <div className="absolute inset-0 z-[1] bg-gradient-to-b from-[#080808]/60 via-[#080808]/30 to-[#080808]/80 pointer-events-none" />

        {/* content */}
        <div className="relative z-[2] flex flex-col items-center px-6 pt-24 pb-28 max-w-3xl mx-auto">

          {/* eyebrow */}
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px w-8 bg-white/20" />
            <span className="text-[11px] uppercase tracking-[0.3em] text-zinc-400 font-medium">
              AI-Powered Learning
            </span>
            <div className="h-px w-8 bg-white/20" />
          </div>

          {/* headline — reduced from 9rem to ~5rem max */}
          <h1 className="font-black leading-[0.92] tracking-[-0.04em] mb-6">
            <span className="block text-[clamp(2.8rem,6vw,5rem)] text-white">Study smarter.</span>
            <span className="block text-[clamp(2.8rem,6vw,5rem)] text-zinc-500">Not harder.</span>
          </h1>

          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-md mb-10">
            Drop any material — PDF, video, audio, link. Zenius turns it into
            notes, flashcards, quizzes, and podcasts. Instantly.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="group flex items-center gap-2.5 bg-white text-black font-bold px-7 py-3.5 rounded-2xl text-sm transition-all duration-200 hover:bg-zinc-100 hover:shadow-[0_0_50px_rgba(255,255,255,0.2)] hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-60"
            >
              <Download size={15} />
              {downloading ? 'Downloading…' : 'Download for Android'}
              <span className="text-zinc-500 font-normal text-xs">Free</span>
            </button>
            <a
              href="https://your-app-url.com"
              className="group flex items-center gap-2 border border-white/15 text-zinc-300 hover:text-white hover:border-white/30 px-7 py-3.5 rounded-2xl text-sm font-medium transition-all duration-200 hover:bg-white/[0.06] backdrop-blur-sm"
            >
              Try in browser
              <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
          </div>

          {/* trust row */}
          <div className="flex flex-wrap items-center justify-center gap-5">
            {['Free forever', 'Android 7.0+', 'No account needed'].map(t => (
              <span key={t} className="flex items-center gap-1.5 text-xs text-zinc-600">
                <CheckCircle2 size={11} className="text-zinc-600" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ MARQUEE ════════════════ */}
      <div className="border-y border-white/[0.06] py-4 overflow-hidden bg-[#050505]">
        <style>{`
          @keyframes marquee {
            from { transform: translateX(0); }
            to   { transform: translateX(-50%); }
          }
        `}</style>
        <MarqueeTicker />
      </div>

      {/* ════════════════ FEATURES ════════════════ */}
      <section id="features" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div
            ref={featRef.ref}
            className={`transition-all duration-700 ${featRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            {/* section header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-16">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-px w-6 bg-white/30" />
                  <span className="text-[11px] uppercase tracking-[0.25em] text-zinc-600">Features</span>
                </div>
                <h2 className="text-4xl sm:text-5xl font-black tracking-[-0.03em] leading-tight">
                  One app.<br />
                  <span className="text-zinc-600">Every format.</span>
                </h2>
              </div>
              <p className="text-zinc-600 text-sm max-w-xs leading-relaxed lg:text-right">
                Stop juggling tools. Zenius handles your entire study workflow — from raw material to mastery.
              </p>
            </div>

            {/* feature grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.05] border border-white/[0.05] rounded-3xl overflow-hidden">
              {FEATURES.map(({ Icon, title, desc }, i) => (
                <div
                  key={title}
                  className="group bg-[#080808] p-8 hover:bg-[#0f0f0f] transition-colors duration-300 cursor-default"
                  style={{
                    opacity: featRef.visible ? 1 : 0,
                    transform: featRef.visible ? 'none' : 'translateY(20px)',
                    transition: `opacity 0.5s ease ${i * 70}ms, transform 0.5s ease ${i * 70}ms, background-color 0.3s`,
                  }}
                >
                  <div className="w-11 h-11 rounded-2xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center mb-6 group-hover:border-white/20 group-hover:bg-white/[0.07] transition-all duration-300">
                    <Icon size={18} className="text-zinc-400 group-hover:text-white transition-colors duration-300" />
                  </div>
                  <h3 className="font-bold text-sm text-white mb-2">{title}</h3>
                  <p className="text-zinc-600 text-sm leading-relaxed group-hover:text-zinc-500 transition-colors duration-300">{desc}</p>
                  <div className="mt-6 flex items-center gap-1.5 text-[11px] text-zinc-800 group-hover:text-zinc-600 transition-colors duration-300">
                    <span>Learn more</span>
                    <MoveRight size={11} className="group-hover:translate-x-1 transition-transform duration-300" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════ HOW IT WORKS ════════════════ */}
      <section id="how-it-works" className="py-32 px-6 border-t border-white/[0.05]">
        <div className="max-w-7xl mx-auto">
          <HowSection />
        </div>
      </section>

      {/* ════════════════ DOWNLOAD CTA ════════════════ */}
      <section id="download" className="py-32 px-6 border-t border-white/[0.05]">
        <div
          ref={ctaRef.ref}
          className={`max-w-7xl mx-auto transition-all duration-700 ${ctaRef.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="relative rounded-3xl overflow-hidden border border-white/[0.08] bg-[#0c0c0c]">

            {/* corner accents */}
            <div className="absolute top-0 left-0 w-32 h-32 border-t border-l border-white/10 rounded-tl-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-32 h-32 border-b border-r border-white/10 rounded-br-3xl pointer-events-none" />

            {/* top line glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

            <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12 p-12 lg:p-20">

              {/* left */}
              <div className="flex-1 text-center lg:text-left">
                {/* logo.svg directly — no white box wrapper */}
                <div className="inline-flex items-center justify-center mb-8">
                  <Image
                    src="/logo.svg"
                    alt="Zenius"
                    width={56}
                    height={40}
                    className="object-contain brightness-0 invert opacity-90"
                  />
                </div>
                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-[-0.03em] leading-[0.95] mb-6">
                  Ready to<br />
                  <span className="text-zinc-600">study smarter?</span>
                </h2>
                <p className="text-zinc-600 text-base max-w-sm mx-auto lg:mx-0 leading-relaxed">
                  Download Zenius for Android and start turning any material into mastery — for free.
                </p>
              </div>

              {/* right */}
              <div className="flex flex-col items-center lg:items-end gap-6">
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="group flex items-center gap-3 bg-white text-black font-black px-10 py-5 rounded-2xl text-base transition-all duration-200 hover:bg-zinc-100 hover:shadow-[0_0_60px_rgba(255,255,255,0.2)] hover:-translate-y-1 active:scale-[0.97] disabled:opacity-60"
                >
                  <Download size={18} />
                  {downloading ? 'Starting download…' : 'Download Zenius APK'}
                  <ArrowUpRight size={16} className="text-zinc-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>

                <div className="flex flex-col gap-2">
                  {['Free forever', 'Android 7.0+', 'No account needed'].map(t => (
                    <span key={t} className="flex items-center gap-2 text-xs text-zinc-700">
                      <CheckCircle2 size={12} className="text-zinc-600" />
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════ FOOTER ════════════════ */}
      <footer className="border-t border-white/[0.05] py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative w-5 h-4 overflow-hidden">
              <Image src="/logo.svg" alt="Zenius" fill className="object-contain brightness-0 invert opacity-30" />
            </div>
            <span className="text-xs text-zinc-700">Zenius · Built by Semeriya Seid</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-zinc-700">
            <a href="https://your-app-url.com" className="hover:text-zinc-400 transition-colors">Open App</a>
            <button onClick={handleDownload} className="hover:text-zinc-400 transition-colors">Download APK</button>
          </div>
        </div>
      </footer>

    </div>
  );
}

/* ── marquee ticker ── */
const TICKER_ITEMS = [
  'Smart Notes', 'Auto Flashcards', 'AI Quizzes', 'Study Podcasts',
  'AI Tutor', 'YouTube Import', 'Audio Transcription', 'Spaced Repetition',
];

function MarqueeTicker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div
      className="flex gap-12 whitespace-nowrap w-max"
      style={{ animation: 'marquee 22s linear infinite' }}
    >
      {items.map((t, i) => (
        <span key={i} className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-zinc-700">
          <span className="w-1 h-1 rounded-full bg-zinc-700" />
          {t}
        </span>
      ))}
    </div>
  );
}

/* ── how it works ── */
function HowSection() {
  const { ref, visible } = useInView(0.1);
  const steps = [
    { n: '01', title: 'Upload anything', body: 'PDF, DOCX, PPTX, audio file, YouTube link, or plain text. Any format works.' },
    { n: '02', title: 'AI processes it', body: 'Six AI models extract, clean, and structure your content in seconds.' },
    { n: '03', title: 'Study smarter',   body: 'Notes, flashcards, quizzes, podcasts — all ready. Pick your format.' },
  ];
  return (
    <div ref={ref}>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-px w-6 bg-white/30" />
        <span className="text-[11px] uppercase tracking-[0.25em] text-zinc-600">How it works</span>
      </div>
      <h2 className="text-4xl sm:text-5xl font-black tracking-[-0.03em] leading-tight mb-16">
        Three steps.<br />
        <span className="text-zinc-600">Zero friction.</span>
      </h2>
      <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
        {steps.map(({ n, title, body }, i) => (
          <div
            key={n}
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'none' : 'translateY(24px)',
              transition: `opacity 0.6s ease ${i * 150}ms, transform 0.6s ease ${i * 150}ms`,
            }}
          >
            <div className="text-[80px] font-black text-white/[0.04] leading-none mb-4 select-none tracking-tighter">
              {n}
            </div>
            <div className="w-10 h-px bg-white/20 mb-5" />
            <h3 className="font-bold text-lg text-white mb-3">{title}</h3>
            <p className="text-zinc-600 text-sm leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
