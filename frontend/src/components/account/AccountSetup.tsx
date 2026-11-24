'use client';

import { NextIntlClientProvider, useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { ErrorState } from '@/components/layout/States';
import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';
import {
  useAccountSetupVerify,
  useAccountSetupComplete,
  useAccountSetupResend,
} from '@/lib/api/generated/account-setup/account-setup';
import type { CompletedSetupView, SetupLinkView } from '@/lib/api/generated/model';
import { ApiError } from '@/lib/api/mutator';
import { useSession } from '@/lib/useSession';
import { useSetupLocale } from './SetupLocaleProvider';
import en from '@/messages/en.json';
import ar from '@/messages/ar.json';

type Stage =
  'checking' | 'ready' | 'expired' | 'used' | 'invalid' | 'error' | 'resent' | 'completed';
const setupDestinations = {
  supplier_profile: '/profile',
  my_assignments: '/my-assignments',
  employee_tenders: '/employee/tenders',
} satisfies Record<CompletedSetupView['next'], string>;

function errorCode(error: unknown) {
  return error instanceof ApiError
    ? error.status === 404
      ? 'NOT_FOUND'
      : error.code
    : 'UNKNOWN_ERROR';
}

export function AccountSetup() {
  const routeLocale = useLocale();
  const setupLocale = useSetupLocale();
  const setSetupLocale = setupLocale?.setLocale;
  const router = useRouter();
  const { establish } = useSession();
  const secret = useRef<string | null>(null);
  const initial = useRef<Promise<SetupLinkView> | null>(null);
  const completed = useRef<CompletedSetupView | null>(null);
  const activeRequest = useRef(false);
  const [view, setView] = useState<SetupLinkView | null>(null);
  const [stage, setStage] = useState<Stage>('checking');
  const [failure, setFailure] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retryUntil, setRetryUntil] = useState(0);
  const { mutateAsync: verify, reset: resetVerify } = useAccountSetupVerify<ApiError>({
    mutation: { retry: false, gcTime: 0 },
  });
  const { mutateAsync: complete, reset: resetComplete } = useAccountSetupComplete<ApiError>({
    mutation: { retry: false, gcTime: 0 },
  });
  const { mutateAsync: resend, reset: resetResend } = useAccountSetupResend<ApiError>({
    mutation: { retry: false, gcTime: 0 },
  });
  const language =
    setupLocale?.locale ?? view?.preferredLanguage ?? (routeLocale === 'ar' ? 'ar' : 'en');

  useEffect(() => {
    let active = true;
    if (!initial.current) {
      // Read the fragment once, remove it from the address bar, and retain it only in memory.
      // Never put setup tokens in request URLs, query keys or persisted state (§1.1, S2 slice).
      const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
      window.history.replaceState(window.history.state, '', window.location.pathname);
      secret.current = token && token.length <= 200 ? token : null;
      initial.current = secret.current
        ? verify({ data: { token: secret.current } }).finally(resetVerify)
        : Promise.reject(new ApiError(404, { error: { code: 'NOT_FOUND' } }));
    }
    void initial.current
      .then((result) => {
        if (!active) return;
        setSetupLocale?.(result.preferredLanguage);
        setView(result);
        setStage('ready');
      })
      .catch((error: unknown) => {
        if (!active) return;
        const code = errorCode(error);
        setStage(
          code === 'SETUP_LINK_EXPIRED'
            ? 'expired'
            : code === 'SETUP_LINK_USED'
              ? 'used'
              : code === 'NOT_FOUND'
                ? 'invalid'
                : 'error',
        );
        setFailure(code);
        if (error instanceof ApiError && code === 'RATE_LIMITED')
          setRetryUntil(Date.now() + error.retryAfterMs);
      });
    return () => {
      active = false;
    };
  }, [verify, resetVerify, setSetupLocale]);

  useEffect(() => () => setSetupLocale?.(null), [setSetupLocale]);

  useEffect(() => {
    if (!retryUntil) return;
    const timer = setTimeout(() => setRetryUntil(0), Math.max(0, retryUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [retryUntil]);

  function failed(error: unknown, fallback: Stage) {
    const code = errorCode(error);
    setFailure(code);
    setStage(
      code === 'SETUP_LINK_EXPIRED'
        ? 'expired'
        : code === 'SETUP_LINK_USED'
          ? 'used'
          : code === 'NOT_FOUND'
            ? 'invalid'
            : fallback,
    );
    if (error instanceof ApiError && code === 'RATE_LIMITED')
      setRetryUntil(Date.now() + error.retryAfterMs);
    if (
      error instanceof ApiError &&
      (code === 'PASSWORD_TOO_WEAK' || error.fields.some((field) => field.field === 'password'))
    )
      setPasswordError(true);
  }

  async function finishSession(result: CompletedSetupView) {
    try {
      // Establish clears the whole cache and renews the session-bound CSRF token before navigation.
      await establish({
        user: result.user,
        supplier: result.supplier,
        serverTime: result.serverTime,
      });
      completed.current = null;
      router.replace(setupDestinations[result.next], {
        locale: result.user.preferredLanguage,
      });
    } catch {
      // The password may already be saved: retry only session initialization, never consume again.
      setStage('completed');
      setFailure('SESSION_START_FAILED');
    }
  }

  async function act(action: 'verify' | 'complete' | 'resend' | 'continue') {
    if (activeRequest.current || retryUntil) return;
    if (action === 'complete' && password.length < 12) {
      setPasswordError(true);
      return;
    }
    if (action !== 'continue' && !secret.current) return;
    activeRequest.current = true;
    setBusy(true);
    setFailure(null);
    setPasswordError(false);
    try {
      if (action === 'continue') {
        if (completed.current) await finishSession(completed.current);
      } else if (action === 'verify') {
        const result = await verify({ data: { token: secret.current! } });
        setSetupLocale?.(result.preferredLanguage);
        setView(result);
        setStage('ready');
      } else if (action === 'resend') {
        await resend({ data: { token: secret.current! } });
        secret.current = null;
        setStage('resent');
      } else {
        const result = await complete({ data: { token: secret.current!, password } });
        resetComplete();
        secret.current = null;
        setPassword('');
        completed.current = result;
        setStage('completed');
        await finishSession(result);
      }
    } catch (error) {
      failed(error, action === 'complete' ? 'ready' : action === 'resend' ? 'expired' : 'error');
    } finally {
      resetVerify();
      resetComplete();
      resetResend();
      activeRequest.current = false;
      setBusy(false);
    }
  }

  return (
    <NextIntlClientProvider
      locale={language}
      messages={{ AccountSetup: (language === 'ar' ? ar : en).AccountSetup }}
    >
      <SetupContent
        language={language}
        view={view}
        stage={stage}
        failure={failure}
        password={password}
        setPassword={setPassword}
        passwordError={passwordError}
        busy={busy}
        blocked={!!retryUntil}
        action={act}
      />
    </NextIntlClientProvider>
  );
}

function SetupContent({
  language,
  view,
  stage,
  failure,
  password,
  setPassword,
  passwordError,
  busy,
  blocked,
  action,
}: {
  language: 'en' | 'ar';
  view: SetupLinkView | null;
  stage: Stage;
  failure: string | null;
  password: string;
  setPassword: (password: string) => void;
  passwordError: boolean;
  busy: boolean;
  blocked: boolean;
  action: (action: 'verify' | 'complete' | 'resend' | 'continue') => Promise<void>;
}) {
  const t = useTranslations('AccountSetup');
  const errors: Record<string, string> = {
    RATE_LIMITED: 'rateLimited',
    VALIDATION_FAILED: 'invalidPassword',
    PASSWORD_TOO_WEAK: 'weakPassword',
    SESSION_START_FAILED: 'sessionFailed',
  };
  return (
    <section
      lang={language}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      className="mx-auto max-w-lg space-y-5 panel p-5 sm:p-7"
    >
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      {stage === 'checking' && <p role="status">{t('checking')}</p>}
      {failure && ['ready', 'error', 'completed'].includes(stage) && (
        <ErrorState title={t(errors[failure] ?? 'failed')} />
      )}
      {stage === 'ready' && (
        <form
          noValidate
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void action('complete');
          }}
        >
          <p>{t('forEmail', { email: view?.email ?? '' })}</p>
          <div className="space-y-2">
            <label htmlFor="setup-password" className="block text-sm font-semibold">
              {t('password')}
            </label>
            <input
              id="setup-password"
              type="password"
              autoComplete="new-password"
              value={password}
              disabled={busy}
              minLength={12}
              aria-invalid={passwordError}
              aria-describedby={`setup-password-hint${passwordError ? ' setup-password-error' : ''}`}
              onChange={(event) => setPassword(event.target.value)}
              className="field-control"
            />
            <p id="setup-password-hint" className="text-sm text-muted-foreground">
              {t('passwordHint')}
            </p>
            {passwordError && (
              <p role="alert" id="setup-password-error" className="text-sm text-destructive">
                {t(failure === 'VALIDATION_FAILED' ? 'invalidPassword' : 'weakPassword')}
              </p>
            )}
          </div>
          <Button type="submit" disabled={busy || blocked}>
            {t(busy ? 'saving' : 'complete')}
          </Button>
        </form>
      )}
      {stage === 'expired' && (
        <div className="space-y-4">
          <p role="status">{t('expired')}</p>
          {failure && !['SETUP_LINK_EXPIRED'].includes(failure) && (
            <ErrorState title={t(errors[failure] ?? 'failed')} />
          )}
          <Button disabled={busy || blocked} onClick={() => void action('resend')}>
            {t('resend')}
          </Button>
        </div>
      )}
      {stage === 'used' && <p role="status">{t('used')}</p>}
      {stage === 'invalid' && <p role="alert">{t('invalid')}</p>}
      {stage === 'resent' && <p role="status">{t('resent')}</p>}
      {stage === 'error' && (
        <Button variant="outline" disabled={busy || blocked} onClick={() => void action('verify')}>
          {t('retry')}
        </Button>
      )}
      {stage === 'completed' && (
        <div className="space-y-3">
          <p role="status">{t('saved')}</p>
          <Button disabled={busy || blocked} onClick={() => void action('continue')}>
            {t('continue')}
          </Button>
        </div>
      )}
      {blocked && stage !== 'checking' && (
        <p role="status" className="text-sm">
          {t('rateLimited')}
        </p>
      )}
      {stage !== 'checking' && (
        <Link
          href="/sign-in"
          locale={language}
          className="inline-block rounded-md text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          {t('signIn')}
        </Link>
      )}
    </section>
  );
}
