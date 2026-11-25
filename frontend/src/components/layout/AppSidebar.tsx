'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link, usePathname } from '@/i18n/navigation';
import { useSession } from '@/lib/useSession';

export function AppSidebar() {
  const t = useTranslations();
  const pathname = usePathname();
  const { session } = useSession();
  const [expanded, setExpanded] = useState(false);
  const menuId = useId();
  if (!session) return null;
  const roles = session.user.roles;
  const legalOnly = roles.length === 1 && roles.includes('legal_committee');
  const links = [
    ...(!legalOnly ? [{ href: '/tenders', label: t('Nav.tenders') }] : []),
    ...(roles.includes('employee')
      ? [{ href: '/employee/tenders', label: t('Nav.myTenders') }]
      : []),
    ...(roles.includes('procurement_officer')
      ? [{ href: '/manage/tenders', label: t('Manage.title') }]
      : []),
    ...(roles.includes('legal_committee')
      ? [{ href: '/signup-reviews', label: t('Signup.legalQueue') }]
      : []),
    ...(roles.includes('admin')
      ? [
          { href: '/signup-requests', label: t('Signup.adminQueue') },
          { href: '/admin/employees', label: t('EmployeeAccounts.nav') },
          { href: '/admin/suppliers', label: t('Suppliers.navDirectory') },
          { href: '/admin/committee-nominations', label: t('Committees.navQueue') },
        ]
      : []),
    ...(roles.includes('supplier') ? [{ href: '/my-bids', label: t('Bids.myBids') }] : []),
    // Committee members, including people with no account role, see their tenders here.
    ...(!roles.includes('supplier')
      ? [{ href: '/my-assignments', label: t('Committees.navAssignments') }]
      : []),
    { href: '/profile', label: t('Nav.profile') },
  ];
  return (
    <aside className="max-h-[40dvh] shrink-0 overflow-y-auto border-b border-sidebar-border bg-sidebar px-4 py-4 sm:px-6 lg:max-h-none lg:border-e lg:border-b-0 lg:px-4 lg:py-8">
      <Button
        variant="outline"
        className="w-full justify-between lg:hidden"
        aria-expanded={expanded}
        aria-controls={menuId}
        onClick={() => setExpanded(!expanded)}
      >
        {t('Nav.toggle')}
        <span aria-hidden="true">{expanded ? '−' : '+'}</span>
      </Button>
      <nav
        id={menuId}
        aria-label={t('Nav.main')}
        className={`${expanded ? 'flex' : 'hidden'} mt-3 flex-col gap-2 lg:mt-0 lg:flex`}
      >
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setExpanded(false)}
            aria-current={pathname === href || pathname.startsWith(href + '/') ? 'page' : undefined}
            className="min-h-11 rounded-md border border-transparent px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-input hover:bg-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:font-semibold aria-[current=page]:text-primary-foreground"
          >
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
