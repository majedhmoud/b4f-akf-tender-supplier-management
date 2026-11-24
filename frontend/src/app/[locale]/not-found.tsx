import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/layout/States';
import { BackLink } from '@/components/ui/back-link';

export default function NotFound() {
  const t = useTranslations('Errors');

  return (
    <div className="flex flex-col gap-4">
      <EmptyState title={t('notFoundTitle')} hint={t('notFoundHint')} />
      <BackLink href="/tenders">{t('backToTenders')}</BackLink>
    </div>
  );
}
