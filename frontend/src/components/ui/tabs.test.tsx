import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

// Protects keyboard access, RTL navigation, panel relationships and focus order.
function Example({ dir = 'ltr' }: { dir?: 'ltr' | 'rtl' }) {
  return (
    <Tabs dir={dir} defaultValue="basics">
      <TabsList aria-label="Sections">
        <TabsTrigger value="basics">Basic information</TabsTrigger>
        <TabsTrigger value="translations">Title and description</TabsTrigger>
        <TabsTrigger value="documents">Terms of Reference</TabsTrigger>
      </TabsList>
      <TabsContent value="basics">Category</TabsContent>
      <TabsContent value="translations">Tender title</TabsContent>
      <TabsContent value="documents">Files</TabsContent>
    </Tabs>
  );
}
describe('Tabs', () => {
  it.each(['ltr', 'rtl'] as const)('supports keyboard navigation in %s', async (dir) => {
    render(<Example dir={dir} />);
    const basic = screen.getByRole('tab', { name: 'Basic information' });
    const translations = screen.getByRole('tab', { name: 'Title and description' });
    act(() => basic.focus());
    fireEvent.keyDown(basic, { key: dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight' });
    await waitFor(() => expect(translations).toHaveFocus());
    expect(translations).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel', { name: 'Title and description' });
    expect(panel).toHaveAttribute('id', translations.getAttribute('aria-controls'));
    expect(panel).toHaveAttribute('aria-labelledby', translations.id);
    expect(basic).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(translations, { key: 'End' });
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Terms of Reference' })).toHaveFocus(),
    );
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Terms of Reference' }), { key: 'Home' });
    await waitFor(() => expect(basic).toHaveFocus());
    expect(basic).toHaveAttribute('aria-selected', 'true');
  });
});
