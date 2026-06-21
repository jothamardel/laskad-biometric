'use client';

import { useEffect, useState, useCallback } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';

type Step = 'loading' | 'ready' | 'scanning' | 'success' | 'error' | 'expired' | 'not_supported';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

interface TransactionInfo {
  amount?: string;
  type?: string;
}

export default function VerifyPage() {
  const [step, setStep] = useState<Step>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [txInfo, setTxInfo] = useState<TransactionInfo>({});
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tok = params.get('token');
    if (!tok) { setStep('expired'); return; }
    setToken(tok);
    if (!window.PublicKeyCredential) { setStep('not_supported'); return; }
    // Optional transaction metadata passed by backend in the URL
    const amount = params.get('amount');
    const type = params.get('type');
    if (amount || type) setTxInfo({ amount: amount ?? undefined, type: type ?? undefined });
    setStep('ready');
  }, []);

  const handleVerify = useCallback(async () => {
    if (!token) return;
    setStep('scanning');
    try {
      // 1. Get authentication options (also seeds the challenge in Redis)
      const optRes = await fetch(`${API_BASE}/auth/biometric/verify-options?token=${token}`);
      if (!optRes.ok) {
        const err = await optRes.json().catch(() => ({}));
        if (optRes.status === 400) { setStep('expired'); return; }
        throw new Error(err.message ?? 'Failed to get verification options');
      }
      const options = await optRes.json();

      // 2. Trigger the browser's biometric prompt
      const credential = await startAuthentication({ optionsJSON: options });

      // 3. Verify signature and release the transaction
      const verifyRes = await fetch(`${API_BASE}/auth/biometric/verify-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, credentialPayload: credential }),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        if (verifyRes.status === 400 && (err.message ?? '').toLowerCase().includes('expired')) {
          setStep('expired'); return;
        }
        throw new Error(err.message ?? 'Signature verification failed');
      }
      setStep('success');
      // Auto-redirect to WhatsApp after 3 seconds
      setTimeout(() => {
        window.location.href = 'https://wa.me/message/LASKAD'; // or standard 'https://wa.me/...' deep link
      }, 3000);
    } catch (err: any) {
      // User dismissed the prompt — silently go back to ready
      if (err?.name === 'NotAllowedError') { setStep('ready'); return; }
      setErrorMsg(err?.message ?? 'Something went wrong. Please try again.');
      setStep('error');
    }
  }, [token]);

  return (
    <div
      className="relative min-h-dvh overflow-hidden flex items-center justify-center px-4 py-6 font-inter"
      style={{ background: 'radial-gradient(ellipse at 60% 0%, #064e3b 0%, #022c22 45%, #090d16 100%)' }}
    >
      {/* ── Ambient orbs ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-20 h-80 w-80 rounded-full bg-emerald-500/[0.1] blur-[80px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -left-16 h-60 w-60 rounded-full bg-teal-500/[0.08] blur-[80px]"
      />

      {/* ── Card ── */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center rounded-3xl border border-emerald-500/20 bg-emerald-950/20 px-7 py-8 backdrop-blur-2xl shadow-[0_0_0_1px_rgba(16,185,129,0.15),0_24px_50px_-12px_rgba(0,0,0,0.7)]">

        {/* ── Brand ── */}
        <div className="flex items-center gap-2.5 mb-8">
          <LaskadLogo />
          <span className="text-xl font-bold text-white tracking-tight">Laskad</span>
        </div>

        {/* ── Loading ── */}
        {step === 'loading' && (
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-full border-[3px] border-emerald-500/20 border-t-emerald-400 animate-spin" />
            <p className="text-xs text-emerald-400/50">Loading verification…</p>
          </div>
        )}

        {/* ── Not Supported ── */}
        {step === 'not_supported' && (
          <StateBlock>
            <WarnIcon />
            <h1 className="text-[22px] font-bold text-white tracking-tight">Not Supported</h1>
            <p className="text-sm text-emerald-100/60 leading-relaxed max-w-[300px] text-center">
              Your browser doesn't support biometric authentication. Open this link on a modern mobile browser like Chrome or Safari.
            </p>
          </StateBlock>
        )}

        {/* ── Expired ── */}
        {step === 'expired' && (
          <StateBlock>
            <WarnIcon />
            <h1 className="text-[22px] font-bold text-white tracking-tight">Link Expired</h1>
            <p className="text-sm text-emerald-100/60 leading-relaxed max-w-[300px] text-center">
              This verification link has expired or is invalid. Please retry your transaction on WhatsApp to receive a fresh link.
            </p>
          </StateBlock>
        )}

        {/* ── Ready ── */}
        {step === 'ready' && (
          <StateBlock>
            {/* Amount pill */}
            {txInfo.amount && (
              <div className="flex flex-col items-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-6 py-3 mb-1">
                <span className="text-[11px] uppercase tracking-widest text-emerald-400/50 mb-1">Transaction Amount</span>
                <span className="text-[28px] font-bold text-white tracking-tight">
                  ₦{Number(txInfo.amount).toLocaleString('en-NG')}
                </span>
              </div>
            )}

            {/* Fingerprint ring with pulse */}
            <div className="relative mb-1 flex items-center justify-center">
              <div className="absolute inset-0 -m-3 rounded-full border border-emerald-500/20 animate-pulse-ring" />
              <div className="w-[108px] h-[108px] rounded-full border border-emerald-500/30 bg-emerald-500/[0.08] flex items-center justify-center text-emerald-400">
                <FingerprintSvg size={52} />
              </div>
            </div>

            <h1 className="text-[22px] font-bold text-white tracking-tight">Authorize Transaction</h1>
            <p className="text-sm text-emerald-100/60 leading-relaxed max-w-[300px] text-center">
              Verify your identity using your biometrics to securely authorize this transaction.
            </p>

            <button
              id="btn-verify"
              onClick={handleVerify}
              className="mt-1.5 w-full flex items-center justify-center gap-2 rounded-2xl border-0 bg-gradient-to-br from-emerald-500 to-teal-700 px-6 py-[15px] text-[15px] font-semibold text-white cursor-pointer transition-all duration-200 shadow-[0_4px_28px_rgba(16,185,129,0.3)] hover:-translate-y-px hover:shadow-[0_8px_36px_rgba(16,185,129,0.4)] active:translate-y-0"
            >
              <FingerprintSvg size={18} />
              Verify with Biometrics
            </button>

            <p className="text-xs text-emerald-400/40">⏱ This link expires in 5 minutes</p>
          </StateBlock>
        )}

        {/* ── Scanning ── */}
        {step === 'scanning' && (
          <StateBlock>
            <div className="w-[108px] h-[108px] rounded-full border border-emerald-500/60 bg-emerald-500/[0.08] flex items-center justify-center text-emerald-400 animate-breathe mb-1">
              <FingerprintSvg size={52} />
            </div>
            <h1 className="text-[22px] font-bold text-white tracking-tight">Complete the Prompt</h1>
            <p className="text-sm text-emerald-100/60 leading-relaxed max-w-[300px] text-center">
              Use your face or fingerprint to confirm the transaction on your device.
            </p>
          </StateBlock>
        )}

        {/* ── Success ── */}
        {step === 'success' && (
          <StateBlock>
            <div className="w-20 h-20 rounded-full border border-emerald-500/30 bg-emerald-500/[0.12] flex items-center justify-center text-emerald-400 animate-pop-in mb-2">
              <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h1 className="text-[22px] font-bold text-white tracking-tight">Transaction Authorized</h1>
            <p className="text-sm text-emerald-100/60 leading-relaxed max-w-[300px] text-center">
              Your biometric signature has been verified. Your transaction is now being processed — you'll receive a WhatsApp confirmation shortly.
            </p>
            {/* Processing badge */}
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-4 py-1.5 text-[13px] text-emerald-400/90">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-blink-dot" />
              Processing…
            </div>
            <a
              href="https://wa.me/message/LASKAD"
              className="mt-1 w-full flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-6 py-[13px] text-sm font-semibold text-emerald-300 transition-all duration-200 hover:bg-emerald-500/20 text-center"
            >
              Return to WhatsApp
            </a>
          </StateBlock>
        )}

        {/* ── Error ── */}
        {step === 'error' && (
          <StateBlock>
            <div className="w-20 h-20 rounded-full border border-red-500/30 bg-red-500/[0.12] flex items-center justify-center text-red-400 mb-2">
              <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h1 className="text-[22px] font-bold text-white tracking-tight">Verification Failed</h1>
            <p className="text-sm text-emerald-100/60 leading-relaxed max-w-[300px] text-center">{errorMsg}</p>
            {token && (
              <button
                id="btn-retry"
                onClick={() => { setErrorMsg(''); setStep('ready'); }}
                className="mt-1 w-full rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-6 py-[13px] text-sm font-medium text-emerald-300 cursor-pointer transition-all duration-200 hover:bg-emerald-500/20"
              >
                Try Again
              </button>
            )}
          </StateBlock>
        )}

        {/* ── Transparency Shield / Security Guarantee ── */}
        <div className="mt-6 pt-5 border-t border-emerald-500/10 w-full text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1.5 text-emerald-400">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="text-xs font-semibold tracking-wide uppercase">Privacy & Transparency</span>
          </div>
          <p className="text-[11px] leading-normal text-emerald-100/40 max-w-[280px] mx-auto">
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

function WarnIcon() {
  return (
    <div className="w-20 h-20 rounded-full border border-amber-500/30 bg-amber-500/[0.12] flex items-center justify-center text-amber-400 mb-2">
      <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
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

function LaskadLogo() {
  return (
    <img
      src="/images/logo.png"
      alt="Laskad Logo"
      className="w-9 h-9 object-contain rounded-lg"
    />
  );
}
