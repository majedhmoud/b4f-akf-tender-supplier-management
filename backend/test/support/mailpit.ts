// Reads captured emails through Mailpit's HTTP API (never its web page), as
// docs/07_CONTRACTS/ACCOUNT_SETUP_EMAIL.md requires.
const MAILPIT = process.env.MAILPIT_API ?? 'http://localhost:8025/api/v1';

export interface CapturedEmail {
  ID: string;
  MessageID: string;
  Subject: string;
  Text: string;
  To: { Address: string }[];
}

interface SearchResult {
  messages: { ID: string }[];
}

async function json<T>(path: string): Promise<T> {
  const response = await fetch(`${MAILPIT}${path}`);
  if (!response.ok) throw new Error(`Mailpit ${path}: ${response.status}`);
  return (await response.json()) as T;
}

export async function emailsTo(address: string): Promise<CapturedEmail[]> {
  const found = await json<SearchResult>(`/search?query=${encodeURIComponent(`to:"${address}"`)}`);
  return Promise.all(found.messages.map((m) => json<CapturedEmail>(`/message/${m.ID}`)));
}

// Waits, up to a bounded time, until `count` emails reached the address.
export async function waitForEmails(
  address: string,
  count = 1,
  timeoutMs = 10_000,
): Promise<CapturedEmail[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const emails = await emailsTo(address);
    if (emails.length >= count) return emails;
    if (Date.now() > deadline) {
      throw new Error(`Expected ${count} email(s) to ${address}, found ${emails.length}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

// The setup token from the link in an email body.
export function tokenFrom(text: string): string {
  const match = /#token=([A-Za-z0-9_-]+)/.exec(text);
  if (!match) throw new Error('No setup link in the email');
  return match[1];
}
