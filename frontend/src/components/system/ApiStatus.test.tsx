import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { useHealthCheck } from '@/lib/api/generated/system/system';
import messages from '@/messages/en.json';
import { ApiStatus } from './ApiStatus';

// Pins what the status card shows for each API answer. The API layer is
// mocked; the component under test is real. See CODING_STANDARDS.md §3.5.
vi.mock('@/lib/api/generated/system/system', () => ({
  useHealthCheck: vi.fn(),
}));

const mockedHook = vi.mocked(useHealthCheck);

function renderStatus(result: Partial<ReturnType<typeof useHealthCheck>>) {
  mockedHook.mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...result,
  } as unknown as ReturnType<typeof useHealthCheck>);

  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ApiStatus />
    </NextIntlClientProvider>,
  );
}

describe('ApiStatus', () => {
  it('shows the database as up when the API answers', () => {
    renderStatus({ data: { status: 'ok', database: 'up' } });

    expect(screen.getByText('Database').nextElementSibling).toHaveTextContent('up');
  });

  it('shows the database as down when the API reports it', () => {
    renderStatus({ data: { status: 'ok', database: 'down' } });

    expect(screen.getByText('Database').nextElementSibling).toHaveTextContent('down');
  });

  it('shows an alert when the API cannot be reached', () => {
    renderStatus({ isError: true });

    expect(screen.getByRole('alert')).toHaveTextContent('The API cannot be reached');
  });
});
