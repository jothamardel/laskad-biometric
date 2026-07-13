'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';

type Step = 'loading' | 'ready' | 'scanning' | 'success' | 'error' | 'expired' | 'not_supported' | 'pw_fallback';

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
  const [redirectUrl, setRedirectUrl] = useState('https://wa.me/2348085614502');

  // Password fallback state
  const [password, setPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const pwInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tok = params.get('token');
    if (!tok) { setStep('expired'); return; }
    setToken(tok);
    if (!window.PublicKeyCredential) { setStep('not_supported'); return; }
    const amount = params.get('amount');
    const type = params.get('type');
    if (amount || type) setTxInfo({ amount: amount ?? undefined, type: type ?? undefined });
    setStep('ready');
  }, []);

  // Auto-focus password input when fallback appears
  useEffect(() => {
    if (step === 'pw_fallback') {
      setTimeout(() => pwInputRef.current?.focus(), 100);
    }
  }, [step]);

  const handleVerify = useCallback(async () => {
    if (!token) return;
    setStep('scanning');
    try {
      const optRes = await fetch(`${API_BASE}/auth/biometric/verify-options?token=${token}`);
      if (!optRes.ok) {
        const err = await optRes.json().catch(() => ({}));
        if (optRes.status === 400) { setStep('expired'); return; }
        throw new Error(err.message ?? 'Failed to get verification options');
      }
      const options = await optRes.json();

      const credential = await startAuthentication({ optionsJSON: options });

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
      const verifyData = await verifyRes.json().catch(() => ({}));
      const rUrl = verifyData.redirectUrl || 'https://wa.me/2348085614502';
      setRedirectUrl(rUrl);
      setStep('success');
      setTimeout(() => { window.location.href = rUrl; }, 3000);
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        // Show password fallback instead of just going back to ready
        setErrorMsg('Biometric prompt was cancelled or not available.');
        setStep('pw_fallback');
        return;
      }
      setErrorMsg(err?.message ?? 'Something went wrong. Please try again.');
      // For all other biometric errors, show fallback too
      setStep('pw_fallback');
    }
  }, [token]);

  const handlePasswordSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !password.trim()) return;
    setPwLoading(true);
    setPwError('');
    try {
      const res = await fetch(`${API_BASE}/auth/biometric/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message ?? 'Incorrect PIN or password. Please try again.');
      }
      const rUrl = data.redirectUrl || 'https://wa.me/2348085614502';
      setRedirectUrl(rUrl);
      setStep('success');
      setTimeout(() => { window.location.href = rUrl; }, 3000);
    } catch (err: any) {
      setPwError(err?.message ?? 'Incorrect PIN or password. Please try again.');
    } finally {
      setPwLoading(false);
    }
  }, [token, password]);

  return (
    <div
      className="relative min-h-dvh overflow-hidden flex items-center justify-center px-4 py-6 font-inter"
      style={{ background: 'radial-gradient(ellipse at 60% 0%, #1e3a8a 0%, #0f172a 45%, #020617 100%)' }}
    >
      {/* ── Ambient orbs ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-20 h-80 w-80 rounded-full bg-blue-600/[0.15] blur-[80px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -left-16 h-60 w-60 rounded-full bg-indigo-600/[0.1] blur-[80px]"
      />

      {/* ── Card ── */}
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
            <p className="text-xs text-slate-500">Loading verification…</p>
          </div>
        )}

        {/* ── Not Supported ── */}
        {step === 'not_supported' && (
          <StateBlock>
            <WarnIcon />
            <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Not Supported</h1>
            <p className="text-sm text-slate-600 leading-relaxed max-w-[300px] text-center">
              Your browser doesn't support biometric authentication. Open this link on a modern mobile browser like Chrome or Safari.
            </p>
          </StateBlock>
        )}

        {/* ── Expired ── */}
        {step === 'expired' && (
          <StateBlock>
            <WarnIcon />
            <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Link Expired</h1>
            <p className="text-sm text-slate-600 leading-relaxed max-w-[300px] text-center">
              This verification link has expired or is invalid. Please retry your transaction on WhatsApp to receive a fresh link.
            </p>
          </StateBlock>
        )}

        {/* ── Ready ── */}
        {step === 'ready' && (
          <StateBlock>
            {txInfo.amount && (
              <div className="flex flex-col items-center rounded-2xl border border-blue-100 bg-blue-50/50 px-6 py-3 mb-1">
                <span className="text-[11px] uppercase tracking-widest text-slate-400 mb-1">Transaction Amount</span>
                <span className="text-[28px] font-bold text-slate-900 tracking-tight">
                  ₦{Number(txInfo.amount).toLocaleString('en-NG')}
                </span>
              </div>
            )}

            <div className="relative mb-1 flex items-center justify-center">
              <div className="absolute inset-0 -m-3 rounded-full border border-blue-500/20 animate-pulse-ring" />
              <div className="w-[108px] h-[108px] rounded-full border border-blue-200 bg-blue-50/60 flex items-center justify-center text-blue-600">
                <FingerprintSvg size={52} />
              </div>
            </div>

            <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Authorize Transaction</h1>
            <p className="text-sm text-slate-600 leading-relaxed max-w-[300px] text-center">
              Verify your identity using your biometrics to securely authorize this transaction.
            </p>

            <button
              id="btn-verify"
              onClick={handleVerify}
              className="mt-1.5 w-full flex items-center justify-center gap-2 rounded-2xl border-0 bg-gradient-to-br from-blue-700 to-indigo-900 px-6 py-[15px] text-[15px] font-semibold text-white cursor-pointer transition-all duration-200 shadow-[0_4px_24px_rgba(29,78,216,0.3)] hover:-translate-y-px hover:shadow-[0_8px_32px_rgba(29,78,216,0.4)] active:translate-y-0"
            >
              <FingerprintSvg size={18} />
              Verify with Biometrics
            </button>

            <p className="text-xs text-slate-400">⏱ This link expires in 5 minutes</p>
          </StateBlock>
        )}

        {/* ── Scanning ── */}
        {step === 'scanning' && (
          <StateBlock>
            <div className="w-[108px] h-[108px] rounded-full border border-blue-400 bg-blue-50 flex items-center justify-center text-blue-600 animate-breathe mb-1">
              <FingerprintSvg size={52} />
            </div>
            <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Complete the Prompt</h1>
            <p className="text-sm text-slate-600 leading-relaxed max-w-[300px] text-center">
              Use your face or fingerprint to confirm the transaction on your device.
            </p>
          </StateBlock>
        )}

        {/* ── Success ── */}
        {step === 'success' && (
          <StateBlock>
            <div className="w-20 h-20 rounded-full border border-blue-200 bg-blue-50 flex items-center justify-center text-blue-600 animate-pop-in mb-2">
              <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Transaction Authorized</h1>
            <p className="text-sm text-slate-600 leading-relaxed max-w-[300px] text-center">
              Your identity has been verified. Your transaction is now being processed — you'll receive a WhatsApp confirmation shortly.
            </p>
            <div className="flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-4 py-1.5 text-[13px] text-blue-700 font-medium">
              <span className="h-2 w-2 rounded-full bg-blue-600 animate-blink-dot" />
              Processing…
            </div>
            <a
              href={redirectUrl}
              className="mt-1 w-full flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-[13px] text-sm font-semibold text-slate-700 transition-all duration-200 hover:bg-slate-100 text-center"
            >
              Return to WhatsApp
            </a>
          </StateBlock>
        )}

        {/* ── Password Fallback ── */}
        {step === 'pw_fallback' && (
          <StateBlock>
            {/* Error from biometric attempt */}
            {errorMsg && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left w-full">
                <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <p className="text-[13px] text-amber-800 leading-relaxed">{errorMsg}</p>
              </div>
            )}

            <div className="w-16 h-16 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 mb-1">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>

            <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Verify with PIN</h1>
            <p className="text-sm text-slate-600 leading-relaxed max-w-[300px] text-center">
              Enter your 6-digit transaction PIN or account password to authorize this transaction.
            </p>

            {txInfo.amount && (
              <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-2 text-[13px] text-blue-700 font-medium">
                Amount: <strong>₦{Number(txInfo.amount).toLocaleString('en-NG')}</strong>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="w-full flex flex-col gap-3 mt-1" noValidate>
              <div className="relative">
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  ref={pwInputRef}
                  id="verify-password-input"
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  placeholder="Enter PIN or password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={pwLoading}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 text-[15px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all disabled:opacity-50"
                  aria-label="Transaction PIN or account password"
                />
              </div>

              {pwError && (
                <p className="text-[13px] text-red-600 text-center">{pwError}</p>
              )}

              <button
                id="verify-password-submit"
                type="submit"
                disabled={pwLoading || !password.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-900 px-6 py-[14px] text-[15px] font-semibold text-white transition-all duration-200 shadow-[0_4px_24px_rgba(29,78,216,0.3)] hover:-translate-y-px hover:shadow-[0_8px_32px_rgba(29,78,216,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
              >
                {pwLoading ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Verifying…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                    </svg>
                    Authorize Transaction
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setErrorMsg(''); setStep('ready'); }}
                className="text-[13px] text-slate-500 hover:text-slate-700 transition-colors py-1"
              >
                ← Try biometrics instead
              </button>
            </form>
          </StateBlock>
        )}

        {/* ── Error (non-biometric errors) ── */}
        {step === 'error' && (
          <StateBlock>
            <div className="w-20 h-20 rounded-full border border-red-200 bg-red-50 flex items-center justify-center text-red-500 mb-2">
              <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Verification Failed</h1>
            <p className="text-sm text-slate-600 leading-relaxed max-w-[300px] text-center">{errorMsg}</p>
            {token && (
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

        {/* ── Transparency Shield ── */}
        <div className="mt-6 pt-5 border-t border-slate-100 w-full text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1.5 text-blue-600">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="text-xs font-semibold tracking-wide uppercase">Privacy &amp; Transparency</span>
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
