'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ErrorState } from '@/components/layout/States';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from '@/i18n/navigation';
import { useAuthSignIn } from '@/lib/api/generated/auth/auth';
import { ApiError } from '@/lib/api/mutator';
import { signInDestination } from '@/lib/authNavigation';
import { useSession } from '@/lib/useSession';

export function SignInForm() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const params = useSearchParams();
  const { establish, session, isLoading } = useSession();
  const mutation = useAuthSignIn<ApiError>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const returnTo = params.get('returnTo');

  useEffect(() => {
    if (session && !submitting) {
      router.replace(signInDestination(returnTo, session.user.roles), {
        locale: session.user.preferredLanguage,
      });
    }
  }, [session, submitting, returnTo, router]);

  useEffect(() => {
    if (!blockedUntil) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000)));
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [blockedUntil]);

  function fieldError(field: string) {
    if (!(error instanceof ApiError) || error.code !== 'VALIDATION_FAILED') return undefined;
    const entry = error.fields.find((item) => item.field === field);
    if (!entry) return undefined;
    if (['REQUIRED', 'isNotEmpty'].includes(entry.code)) return t('required');
    if (['INVALID_EMAIL', 'isEmail'].includes(entry.code)) return t('invalidEmail');
    return t('invalidField');
  }

  function errorText() {
    if (remaining > 0) return t('rateLimited', { seconds: remaining });
    if (!error) return null;
    if (error instanceof ApiError) {
      if (error.code === 'VALIDATION_FAILED') return t('validationFailed');
      if (error.code === 'RATE_LIMITED') return null;
      const codes = {
        INVALID_CREDENTIALS: 'invalidCredentials',
        ACCOUNT_PENDING_SETUP: 'pendingSetup',
        ACCOUNT_DISABLED: 'disabled',
      } as const;
      if (error.code in codes) return t(codes[error.code as keyof typeof codes]);
    }
    return t('failed');
  }

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || remaining > 0) return;
    setError(null);
    setSubmitting(true);
    try {
      const nextSession = await mutation.mutateAsync({ data: { email, password } });
      await establish(nextSession);
      router.replace(signInDestination(returnTo, nextSession.user.roles), {
        locale: nextSession.user.preferredLanguage,
      });
    } catch (failure) {
      setError(failure);
      if (failure instanceof ApiError && failure.code === 'RATE_LIMITED') {
        setBlockedUntil(Date.now() + failure.retryAfterMs);
        setRemaining(Math.ceil(failure.retryAfterMs / 1000));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const alert = errorText();
  return (
    <Card className="mx-auto my-4 w-full max-w-md gap-6 rounded-md border py-6 ring-0 sm:my-10">
      <CardHeader className="px-6">
        <CardTitle className="text-xl font-bold tracking-tight text-foreground">
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6">
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-sm font-medium">
              {t('email')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              dir="ltr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              aria-invalid={!!fieldError('email')}
              aria-describedby={fieldError('email') ? 'email-error' : undefined}
              className="field-control h-11 text-start"
            />
            {fieldError('email') && (
              <p id="email-error" className="text-sm text-destructive">
                {fieldError('email')}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm font-medium">
              {t('password')}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              dir="ltr"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              aria-invalid={!!fieldError('password')}
              aria-describedby={fieldError('password') ? 'password-error' : undefined}
              className="field-control h-11 text-start"
            />
            {fieldError('password') && (
              <p id="password-error" className="text-sm text-destructive">
                {fieldError('password')}
              </p>
            )}
          </div>
          {alert && <ErrorState title={alert} />}
          <Button
            type="submit"
            disabled={isLoading || submitting || remaining > 0}
            className="h-11 font-semibold hover:bg-deep-green"
          >
            {submitting ? t('signingIn') : t('signIn')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
