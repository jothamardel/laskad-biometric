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
      style={{ background: 'radial-gradient(ellipse at 60% 0%, #1e1b4b 0%, #0f0e17 55%)' }}
    >
      {/* ── Ambient orbs ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-20 h-80 w-80 rounded-full bg-indigo-500/[0.18] blur-[80px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -left-16 h-60 w-60 rounded-full bg-violet-500/[0.12] blur-[80px]"
      />

      {/* ── Card ── */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center rounded-3xl border border-white/[0.09] bg-white/[0.04] px-7 py-8 backdrop-blur-2xl shadow-[0_0_0_1px_rgba(99,102,241,0.12),0_32px_80px_rgba(0,0,0,0.55)]">

        {/* ── Brand ── */}
        <div className="flex items-center gap-2.5 mb-8">
          <LaskadLogo />
          <span className="text-xl font-bold text-white tracking-tight">Laskad</span>
        </div>

        {/* ── Loading ── */}
        {step === 'loading' && (
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-full border-[3px] border-indigo-500/20 border-t-indigo-500 animate-spin" />
            <p className="text-xs text-white/30">Loading verification…</p>
          </div>
        )}

        {/* ── Not Supported ── */}
        {step === 'not_supported' && (
          <StateBlock>
            <WarnIcon />
            <h1 className="text-[22px] font-bold text-white tracking-tight">Not Supported</h1>
            <p className="text-sm text-white/55 leading-relaxed max-w-[300px] text-center">
              Your browser doesn't support biometric authentication. Open this link on a modern mobile browser like Chrome or Safari.
            </p>
          </StateBlock>
        )}

        {/* ── Expired ── */}
        {step === 'expired' && (
          <StateBlock>
            <WarnIcon />
            <h1 className="text-[22px] font-bold text-white tracking-tight">Link Expired</h1>
            <p className="text-sm text-white/55 leading-relaxed max-w-[300px] text-center">
              This verification link has expired or is invalid. Please retry your transaction on WhatsApp to receive a fresh link.
            </p>
          </StateBlock>
        )}

        {/* ── Ready ── */}
        {step === 'ready' && (
          <StateBlock>
            {/* Amount pill */}
            {txInfo.amount && (
              <div className="flex flex-col items-center rounded-2xl border border-indigo-500/25 bg-indigo-500/10 px-6 py-3 mb-1">
                <span className="text-[11px] uppercase tracking-widest text-white/40 mb-1">Transaction Amount</span>
                <span className="text-[28px] font-bold text-white tracking-tight">
                  ₦{Number(txInfo.amount).toLocaleString('en-NG')}
                </span>
              </div>
            )}

            {/* Fingerprint ring with pulse */}
            <div className="relative mb-1 flex items-center justify-center">
              <div className="absolute inset-0 -m-3 rounded-full border border-indigo-500/20 animate-pulse-ring" />
              <div className="w-[108px] h-[108px] rounded-full border border-indigo-500/30 bg-indigo-500/[0.08] flex items-center justify-center text-indigo-400">
                <FingerprintSvg size={52} />
              </div>
            </div>

            <h1 className="text-[22px] font-bold text-white tracking-tight">Authorize Transaction</h1>
            <p className="text-sm text-white/55 leading-relaxed max-w-[300px] text-center">
              Verify your identity using your biometrics to securely authorize this transaction.
            </p>

            <button
              id="btn-verify"
              onClick={handleVerify}
              className="mt-1.5 w-full flex items-center justify-center gap-2 rounded-2xl border-0 bg-gradient-to-br from-indigo-500 to-indigo-700 px-6 py-[15px] text-[15px] font-semibold text-white cursor-pointer transition-all duration-200 shadow-[0_4px_28px_rgba(99,102,241,0.4)] hover:-translate-y-px hover:shadow-[0_8px_36px_rgba(99,102,241,0.5)] active:translate-y-0"
            >
              <FingerprintSvg size={18} />
              Verify with Biometrics
            </button>

            <p className="text-xs text-white/30">⏱ This link expires in 5 minutes</p>
          </StateBlock>
        )}

        {/* ── Scanning ── */}
        {step === 'scanning' && (
          <StateBlock>
            <div className="w-[108px] h-[108px] rounded-full border border-indigo-500/60 bg-indigo-500/[0.08] flex items-center justify-center text-indigo-400 animate-breathe mb-1">
              <FingerprintSvg size={52} />
            </div>
            <h1 className="text-[22px] font-bold text-white tracking-tight">Complete the Prompt</h1>
            <p className="text-sm text-white/55 leading-relaxed max-w-[300px] text-center">
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
            <p className="text-sm text-white/55 leading-relaxed max-w-[300px] text-center">
              Your biometric signature has been verified. Your transaction is now being processed — you'll receive a WhatsApp confirmation shortly.
            </p>
            {/* Processing badge */}
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-4 py-1.5 text-[13px] text-emerald-400/90">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-blink-dot" />
              Processing…
            </div>
            <p className="text-xs text-white/30">You can close this window.</p>
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
            <p className="text-sm text-white/55 leading-relaxed max-w-[300px] text-center">{errorMsg}</p>
            {token && (
              <button
                id="btn-retry"
                onClick={() => { setErrorMsg(''); setStep('ready'); }}
                className="mt-1 w-full rounded-2xl border border-white/15 bg-white/[0.06] px-6 py-[13px] text-sm font-medium text-white/80 cursor-pointer transition-all duration-200 hover:bg-white/10 hover:border-white/25"
              >
                Try Again
              </button>
            )}
          </StateBlock>
        )}

        <p className="mt-7 text-center text-[11px] leading-relaxed text-white/20">
          Secured by WebAuthn · Biometric data never leaves your device
        </p>
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
    <svg width="36" height="36" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="15" stroke="url(#vlg1)" strokeWidth="2" />
      <path d="M10 22V10l6 9 6-9v12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="vlg1" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#818cf8" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
    </svg>
  );
}
