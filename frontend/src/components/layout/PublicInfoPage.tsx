import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

const content = {
  About: {
    sections: ['platform', 'suppliers', 'help'],
    action: '/tenders',
  },
  Terms: {
    sections: ['accounts', 'submissions', 'requirements', 'communication'],
    action: '/about',
  },
} as const;

export async function PublicInfoPage({
  locale,
  page,
}: {
  locale: string;
  page: keyof typeof content;
}) {
  const t = await getTranslations({ locale, namespace: page });
  const { sections, action } = content[page];

  return (
    <article className="mx-auto max-w-3xl space-y-7">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </header>
      <div className="panel divide-y divide-border px-5 sm:px-7">
        {sections.map((section) => (
          <section key={section} className="space-y-2 py-5">
            <h2 className="text-lg font-semibold">{t(section + '.title')}</h2>
            <p className="leading-relaxed text-muted-foreground">{t(section + '.body')}</p>
          </section>
        ))}
      </div>
      <Link
        href={`/${locale}${action}`}
        className="font-medium text-primary underline underline-offset-4"
      >
        {t('action')}
      </Link>
    </article>
  );
}
