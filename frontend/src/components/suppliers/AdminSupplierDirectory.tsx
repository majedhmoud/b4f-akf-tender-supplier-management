'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { EmptyState, ErrorState } from '@/components/layout/States';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from '@/i18n/navigation';
import type { SupplierListItem, SupplierStatus } from '@/lib/api/generated/model';
import {
  useAdminSuppliersList,
  useAdminSuppliersReactivate,
  useAdminSuppliersSuspend,
} from '@/lib/api/generated/suppliers/suppliers';
import { privateKey } from '@/lib/api/query-keys';
import { ApiError } from '@/lib/api/mutator';
import { useSession } from '@/lib/useSession';
import { listCardClass } from '@/components/ui/list-card';
import { useReturnFocus } from '@/lib/useReturnFocus';

const PATH = '/admin/suppliers';
const STATUSES: SupplierStatus[] = ['active', 'suspended'];

// P4–P5: the admin's supplier directory with suspend and reactivate
// (API_CONTRACT.md, Suppliers). Filters live in the URL, so a reload keeps them.
export function AdminSupplierDirectory() {
  const t = useTranslations('Suppliers');
  const locale = useLocale();
  const router = useRouter();
  const search = useSearchParams();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const raw = Number(search.get('page'));
  const page = Number.isInteger(raw) && raw > 0 ? raw : 1;
  const statusParam = search.get('status');
  const status = STATUSES.find((s) => s === statusParam);
  const term = search.get('search') ?? '';
  const [draft, setDraft] = useState(term);
  const [previousTerm, setPreviousTerm] = useState(term);
  // Back/forward navigation changes the committed search, not just the results.
  if (previousTerm !== term) {
    setPreviousTerm(term);
    setDraft(term);
  }
  const { register, returnTo } = useReturnFocus();
  const [confirming, setConfirming] = useState<{
    id: string;
    action: 'suspend' | 'reactivate';
  } | null>(null);
  const [actionFailed, setActionFailed] = useState(false);
  const base = privateKey(session?.user.id ?? '', ['admin-suppliers']);
  const params = {
    page,
    limit: 20,
    ...(status ? { status } : {}),
    ...(term ? { search: term } : {}),
  };
  const query = useAdminSuppliersList(params, {
    query: {
      queryKey: [...base, locale, params],
      enabled: !!session,
      retry: false,
    },
  });
  const suspend = useAdminSuppliersSuspend<ApiError>();
  const reactivate = useAdminSuppliersReactivate<ApiError>();
  const busy = suspend.isPending || reactivate.isPending;

  function go(next: { page?: number; status?: string; search?: string }) {
    const merged = { status: status ?? '', search: term, page: 1, ...next };
    router.replace({
      pathname: PATH,
      query: Object.fromEntries(
        Object.entries(merged).filter(([, v]) => v !== '' && v !== undefined && v !== 1),
      ),
    });
  }

  async function act(row: SupplierListItem, action: 'suspend' | 'reactivate') {
    if (busy || !row.allowedActions.includes(action)) return;
    setActionFailed(false);
    try {
      if (action === 'suspend') await suspend.mutateAsync({ supplierId: row.id });
      else await reactivate.mutateAsync({ supplierId: row.id });
      setConfirming(null);
      await queryClient.invalidateQueries({ queryKey: base });
      // The row stays, with its next action: focus it (ADR 0008, rule 5).
      returnTo(row.id);
    } catch {
      setActionFailed(true);
    }
  }

  // One action control for the table and the cards. Suspend and Reactivate
  // are consequential, so they use the default button size (ADR 0008, rule 3).
  function renderAction(row: SupplierListItem, layout: 'table' | 'card') {
    const action = row.allowedActions.includes('suspend')
      ? 'suspend'
      : row.allowedActions.includes('reactivate')
        ? 'reactivate'
        : null;
    if (!action) return null;
    if (confirming?.id === row.id && confirming.action === action)
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span>{t(`confirm.${action}`, { name: row.legalName })}</span>
          <Button
            variant={action === 'suspend' ? 'destructive' : 'default'}
            disabled={busy}
            onClick={() => void act(row, action)}
          >
            {t(`actions.${action}`)}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setConfirming(null);
              returnTo(row.id);
            }}
          >
            {t('cancel')}
          </Button>
        </div>
      );
    return (
      <Button
        ref={register(layout, row.id)}
        variant="outline"
        className={layout === 'card' ? 'w-full' : undefined}
        disabled={busy}
        onClick={() => setConfirming({ id: row.id, action })}
      >
        {t(`actions.${action}`)}
      </Button>
    );
  }

  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">{t('directoryTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('directoryHint')}</p>
      </header>
      <form
        role="search"
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          go({ search: draft.trim() });
        }}
      >
        <div className="min-w-56 flex-1 space-y-2">
          <label htmlFor="supplier-search" className="block text-sm font-semibold">
            {t('search')}
          </label>
          <input
            id="supplier-search"
            type="search"
            maxLength={100}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="field-control h-10"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="supplier-status" className="block text-sm font-semibold">
            {t('statusFilter')}
          </label>
          <select
            id="supplier-status"
            value={status ?? ''}
            onChange={(e) => go({ status: e.target.value })}
            className="field-control h-10 w-auto"
          >
            <option value="">{t('allStatuses')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          {t('searchAction')}
        </Button>
      </form>
      {actionFailed && <ErrorState title={t('actionFailed')} />}
      {query.isPending && <Skeleton className="h-64" />}
      {query.isError && (
        <ErrorState
          title={t('loadFailed')}
          action={<Button onClick={() => void query.refetch()}>{t('retry')}</Button>}
        />
      )}
      {!query.isError &&
        query.data &&
        (query.data.data.length ? (
          <>
            <ul className="space-y-3 lg:hidden">
              {query.data.data.map((row) => (
                <li key={row.id} className={listCardClass}>
                  <p className="font-semibold" dir="auto">
                    {row.legalName}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant={row.status === 'active' ? 'secondary' : 'destructive'}>
                      {t(`status.${row.status}`)}
                    </Badge>
                    <span dir="auto">{row.registrationNumber}</span>
                  </div>
                  {renderAction(row, 'card')}
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto panel lg:block">
              <table className="w-full text-start text-sm">
                <thead className="bg-secondary/50">
                  <tr>
                    {['legalName', 'registrationNumber', 'status', 'action'].map((key) => (
                      <th key={key} scope="col" className="px-5 py-3 text-start">
                        {t(`columns.${key}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {query.data.data.map((row) => {
                    return (
                      <tr key={row.id}>
                        <td className="min-w-44 px-5 py-4" dir="auto">
                          {row.legalName}
                        </td>
                        <td className="px-5 py-4" dir="auto">
                          {row.registrationNumber}
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant={row.status === 'active' ? 'secondary' : 'destructive'}>
                            {t(`status.${row.status}`)}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">{renderAction(row, 'table')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState title={t('empty')} />
        ))}
      {!query.isError && query.data && query.data.meta.totalPages > 1 && (
        <nav
          aria-label={t('pagination')}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <Button variant="outline" disabled={page <= 1} onClick={() => go({ page: page - 1 })}>
            {t('previous')}
          </Button>
          <span>{t('pageOf', { page, total: query.data.meta.totalPages })}</span>
          <Button
            variant="outline"
            disabled={page >= query.data.meta.totalPages}
            onClick={() => go({ page: page + 1 })}
          >
            {t('next')}
          </Button>
        </nav>
      )}
    </section>
  );
}
