import { notFound } from 'next/navigation';

// This route intentionally throws 404 rather than rendering a navigable page.
export const instant = false;

// Any unknown path inside a locale shows the translated not-found page.
export default function CatchAll() {
  notFound();
}
