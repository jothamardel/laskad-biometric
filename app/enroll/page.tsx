'use client';

import { useEffect, useState, useCallback } from 'react';
import { startRegistration } from '@simplewebauthn/browser';

type Step = 'loading' | 'ready' | 'scanning' | 'success' | 'error' | 'already_enrolled' | 'not_supported';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export default function EnrollPage() {
  const [step, setStep] = useState<Step>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('https://wa.me/2348085614502');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('userId');
    if (!id) {
      setErrorMsg('Invalid enrollment link. Please request a new one from Laskad.');
      setStep('error');
      return;
    }
    setUserId(id);
    if (!window.PublicKeyCredential) { setStep('not_supported'); return; }
    setStep('ready');
  }, []);

  const handleEnroll = useCallback(async () => {
    if (!userId) return;
    setStep('scanning');
    try {
      // 1. Get registration options from backend
      const optRes = await fetch(`${API_BASE}/auth/biometric/register-options?userId=${userId}`);
      if (!optRes.ok) {
        const err = await optRes.json().catch(() => ({}));
        throw new Error(err.message ?? 'Failed to get registration options');
      }
      const options = await optRes.json();

      // 2. Trigger the browser's biometric prompt
      const credential = await startRegistration({ optionsJSON: options });

      // 3. Send credential back to backend for verification
      const verifyRes = await fetch(`${API_BASE}/auth/biometric/register-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, credentialPayload: credential }),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err.message ?? 'Verification failed');
      }
      const verifyData = await verifyRes.json().catch(() => ({}));
      const rUrl = verifyData.redirectUrl || 'https://wa.me/2348085614502';
      setRedirectUrl(rUrl);
      setStep('success');
      // Auto-redirect to WhatsApp after 3 seconds
      setTimeout(() => {
        window.location.href = rUrl;
      }, 3000);
    } catch (err: any) {
      // User cancelled — not a real error
      if (err?.name === 'NotAllowedError') { setStep('ready'); return; }
      // Credential already exists on this device
      if (err?.name === 'InvalidStateError') { setStep('already_enrolled'); return; }
      setErrorMsg(err?.message ?? 'Something went wrong. Please try again.');
      setStep('error');
    }
  }, [userId]);

  return (
    <div
      className="relative min-h-dvh flex items-center justify-center px-4 py-6 font-inter overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at top, #1e3a8a 0%, #0f172a 45%, #020617 100%)' }}
    >
      {/* ── Ambient Glows representing security/transparency ── */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-blue-600/10 blur-[80px] pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center rounded-3xl border border-slate-100 bg-white/95 px-7 py-8 backdrop-blur-2xl shadow-[0_24px_50px_-12px_rgba(15,23,42,0.25)]">

        {/* ── Brand ── */}
        <div className="flex items-center gap-2.5 mb-8">
          <LaskadLogo />
          <span className="text-xl font-bold text-slate-900 tracking-tight">Laskad</span>
        </div>

        {/* ── Loading ── */}
        {step === 'loading' && (
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-full border-[3px] border-blue-500/20 border-t-blue-600 animate-spin" />
            <p className="text-xs text-slate-500">Preparing enrollment…</p>
          </div>
        )}

        {/* ── Not Supported ── */}
        {step === 'not_supported' && (
          <StateBlock>
            <IconCircle color="amber">
              <InfoSvg />
            </IconCircle>
            <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Not Supported</h1>
            <p className="text-sm text-slate-600 leading-relaxed max-w-[300px] text-center">
              Your browser or device doesn't support biometric authentication. Please use a modern browser on your phone.
            </p>
          </StateBlock>
        )}

        {/* ── Ready ── */}
        {step === 'ready' && (
          <StateBlock>
            <FingerprintRing scanning={false} />
            <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Enable Biometrics</h1>
            <p className="text-sm text-slate-600 leading-relaxed max-w-[300px] text-center">
              Use your Face ID or fingerprint to authorize Laskad transactions — instantly, no PIN needed.
            </p>
            <ul className="w-full text-left space-y-2.5 my-1">
              {[
                'Instant transaction authorization',
                "Secured by your device's biometrics",
                'Your fingerprint never leaves your phone',
              ].map((text) => (
                <li key={text} className="flex items-center gap-2.5 text-[13px] text-slate-700">
                  <CheckIcon />
                  {text}
                </li>
              ))}
            </ul>
            
            <button
              id="btn-enroll"
              onClick={handleEnroll}
              className="mt-2 w-full flex items-center justify-center gap-2 rounded-2xl border-0 bg-gradient-to-br from-blue-700 to-indigo-900 px-6 py-[14px] text-[15px] font-semibold text-white cursor-pointer transition-all duration-200 shadow-[0_4px_24px_rgba(29,78,216,0.3)] hover:-translate-y-px hover:shadow-[0_8px_32px_rgba(29,78,216,0.4)] active:translate-y-0"
            >
              <FingerprintSvg size={18} />
              Set Up Biometrics
            </button>
          </StateBlock>
        )}

        {/* ── Scanning ── */}
        {step === 'scanning' && (
          <StateBlock>
            <FingerprintRing scanning={true} />
            <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Follow the Prompt</h1>
            <p className="text-sm text-slate-600 leading-relaxed max-w-[300px] text-center">
              Complete the biometric prompt shown by your device to finish enrollment.
            </p>
          </StateBlock>
        )}

        {/* ── Success ── */}
        {step === 'success' && (
          <StateBlock>
            <IconCircle color="emerald" animate="pop-in">
              <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </IconCircle>
            <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">You're All Set!</h1>
            <p className="text-sm text-slate-600 leading-relaxed max-w-[300px] text-center">
              Biometrics enrolled successfully. The next time you make a transaction on Laskad, just tap the link and authenticate with your face or fingerprint.
            </p>
            <a
              href={redirectUrl}
              className="mt-1 w-full flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-[13px] text-sm font-semibold text-slate-700 transition-all duration-200 hover:bg-slate-100 text-center"
            >
              Return to WhatsApp
            </a>
            <p className="text-xs text-slate-400">You can close this window or wait to be redirected.</p>
          </StateBlock>
        )}

        {/* ── Already Enrolled ── */}
        {step === 'already_enrolled' && (
          <StateBlock>
            <IconCircle color="emerald">
              <InfoSvg />
            </IconCircle>
            <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Already Enrolled</h1>
            <p className="text-sm text-slate-600 leading-relaxed max-w-[300px] text-center">
              This device is already registered for biometric authentication. You're ready to go!
            </p>
            <p className="text-xs text-slate-400">You can close this window.</p>
          </StateBlock>
        )}

        {/* ── Error ── */}
        {step === 'error' && (
          <StateBlock>
            <IconCircle color="red">
              <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </IconCircle>
            <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Something Went Wrong</h1>
            <p className="text-sm text-slate-600 leading-relaxed max-w-[300px] text-center">{errorMsg}</p>
            {userId && (
              <button
                id="btn-retry"
                onClick={() => { setErrorMsg(''); setStep('ready'); }}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-[13px] text-sm font-medium text-slate-700 cursor-pointer transition-all duration-200 hover:bg-slate-100"
              >
                Try Again
              </button>
            )}
          </StateBlock>
        )}

        {/* ── Transparency Shield / Security Guarantee ── */}
        <div className="mt-6 pt-5 border-t border-slate-100 w-full text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1.5 text-blue-600">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="text-xs font-semibold tracking-wide uppercase">Privacy & Transparency</span>
          </div>
          <p className="text-[11px] leading-normal text-slate-400 max-w-[280px] mx-auto">
            Laskad never accesses, stores, or transmits your actual fingerprint or Face ID data. All biometrics are verified securely on-device by your hardware key processor.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Shared sub-components ────────────────────────────────────────── */

function StateBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full flex flex-col items-center gap-3.5 text-center">
      {children}
    </div>
  );
}

type Color = 'emerald' | 'red' | 'amber' | 'indigo';
const colorMap: Record<Color, string> = {
  emerald: 'bg-blue-50 border-blue-200 text-blue-600',
  red:     'bg-red-50 border-red-200 text-red-500',
  amber:   'bg-amber-50 border-amber-200 text-amber-600',
  indigo:  'bg-indigo-50 border-indigo-200 text-indigo-600',
};

function IconCircle({
  color,
  animate,
  children,
}: {
  color: Color;
  animate?: 'pop-in';
  children: React.ReactNode;
}) {
  return (
    <div
      className={`w-20 h-20 rounded-full border flex items-center justify-center mb-2 ${colorMap[color]} ${animate === 'pop-in' ? 'animate-pop-in' : ''}`}
    >
      {children}
    </div>
  );
}

function FingerprintRing({ scanning }: { scanning: boolean }) {
  return (
    <div className="relative mb-2">
      {/* Outer dashed spinning ring */}
      <div
        className={`absolute -inset-2 rounded-full border border-dashed border-indigo-500/20 ${scanning ? 'animate-spin-fast' : 'animate-spin-slow'}`}
      />
      {/* Main ring */}
      <div
        className={`relative w-[108px] h-[108px] rounded-full bg-indigo-500/[0.08] flex items-center justify-center transition-all duration-300 ${
          scanning
            ? 'border border-indigo-500/60 animate-breathe'
            : 'border border-indigo-500/25'
        }`}
      >
        <span className="text-indigo-400">
          <FingerprintSvg size={52} />
        </span>
      </div>
    </div>
  );
}

function FingerprintSvg({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M26 8C16.059 8 8 16.059 8 26" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M44 26C44 35.941 35.941 44 26 44" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M14 26C14 19.373 19.373 14 26 14C32.627 14 38 19.373 38 26" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M38 34C36.556 39.108 31.724 43 26 43" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M26 20C22.686 20 20 22.686 20 26C20 29.314 22.686 32 26 32C29.314 32 32 29.314 32 26" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M26 26V38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <circle cx="8" cy="8" r="8" fill="url(#cg)" />
      <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#818cf8" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function InfoSvg() {
  return (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function LaskadLogo() {
  return (
    <img
      src="/images/logo.png"
      alt="Laskad Logo"
      className="w-9 h-9 object-contain rounded-lg"
    />
  );
}
