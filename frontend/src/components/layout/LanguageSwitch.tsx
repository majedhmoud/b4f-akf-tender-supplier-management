'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useSetupLocale } from '@/components/account/SetupLocaleProvider';
import { Button } from '@/components/ui/button';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useMeUpdate } from '@/lib/api/generated/auth/auth';
import type { SessionView } from '@/lib/api/generated/model/sessionView';
import { privateKey } from '@/lib/api/query-keys';
import { useSession } from '@/lib/useSession';

export function LanguageSwitch() {
  const t = useTranslations();
  const setupLocale = useSetupLocale();
  const locale = useLocale();
  const pathname = usePathname();
  const isSetup = /^(?:\/(?:en|ar))?\/account-setup\/?$/.test(pathname);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const update = useMeUpdate();
  const [failed, setFailed] = useState(false);
  const otherLocale = locale === 'ar' ? 'en' : 'ar';
  const query = Object.fromEntries(searchParams.entries());

  async function switchLanguage(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!session) return;
    event.preventDefault();
    if (update.isPending) return;
    setFailed(false);
    try {
      const user = await update.mutateAsync({ data: { preferredLanguage: otherLocale } });
      queryClient.setQueryData<SessionView>(privateKey(user.id, ['session']), (current) =>
        current ? { ...current, user } : current,
      );
      router.replace({ pathname, query }, { locale: otherLocale });
    } catch {
      setFailed(true);
    }
  }

  if (isSetup)
    return (
      <Button
        type="button"
        variant="outline"
        lang={otherLocale}
        aria-label={t('Common.switchLanguageLabel')}
        onClick={() => setupLocale?.setLocale(otherLocale)}
      >
        {t('Common.switchLanguage')}
      </Button>
    );

  return (
    <span className="flex flex-col gap-1">
      <Link
        href={{ pathname, query }}
        locale={otherLocale}
        lang={otherLocale}
        aria-label={t('Common.switchLanguageLabel')}
        aria-disabled={update.isPending || undefined}
        onClick={switchLanguage}
        className="rounded-md px-2 py-1 text-sm text-primary underline underline-offset-4 hover:text-deep-green"
      >
        {t('Common.switchLanguage')}
      </Link>
      {failed && (
        <span role="alert" className="text-sm text-destructive">
          {t('Auth.languageFailed')}
        </span>
      )}
    </span>
  );
}
