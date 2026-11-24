import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/layout/States';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('Errors');

  return (
    <div className="flex flex-col gap-4">
      <EmptyState title={t('notFoundTitle')} hint={t('notFoundHint')} />
      <Link href="/tenders" className="text-sm underline-offset-4 hover:underline">
        {t('backToTenders')}
      </Link>
    </div>
  );
}
