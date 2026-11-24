import request from 'supertest';
import type { App } from 'supertest/types.js';

// A minimal browser for API tests: keeps cookies between requests and sends
// the CSRF header, so tests follow the same flow as the web app
// (API_CONTRACT.md §1.1).
export class TestClient {
  readonly cookies = new Map<string, string>();
  csrfToken = '';

  constructor(private readonly server: App) {}

  private cookieHeader(): string {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  private store(response: request.Response) {
    const setCookie = response.headers['set-cookie'] as unknown as string[] | undefined;
    for (const line of setCookie ?? []) {
      const [pair, ...attributes] = line.split(';');
      const [name, ...rest] = pair.split('=');
      const value = rest.join('=');
      const cleared = attributes.some((a) => /expires=thu, 01 jan 1970/i.test(a.trim()));
      if (!value || cleared) this.cookies.delete(name.trim());
      else this.cookies.set(name.trim(), value);
    }
    return response;
  }

  async get(path: string, headers: Record<string, string> = {}) {
    return this.store(
      await request(this.server).get(path).set('Cookie', this.cookieHeader()).set(headers),
    );
  }

  async send(method: 'post' | 'patch', path: string, body?: object, csrf = true) {
    let req = request(this.server)[method](path).set('Cookie', this.cookieHeader());
    if (csrf) req = req.set('X-CSRF-Token', this.csrfToken);
    return this.store(await (body ? req.send(body) : req));
  }

  async put(path: string, body: object) {
    const req = request(this.server)
      .put(path)
      .set('Cookie', this.cookieHeader())
      .set('X-CSRF-Token', this.csrfToken);
    return this.store(await req.send(body));
  }

  async delete(path: string) {
    const req = request(this.server)
      .delete(path)
      .set('Cookie', this.cookieHeader())
      .set('X-CSRF-Token', this.csrfToken);
    return this.store(await req);
  }

  // A multipart upload, as the web app sends files (API_CONTRACT.md §1.8).
  async upload(
    path: string,
    fields: Record<string, string>,
    file?: { name: string; type: string; content: Buffer },
  ) {
    let req = request(this.server)
      .post(path)
      .set('Cookie', this.cookieHeader())
      .set('X-CSRF-Token', this.csrfToken);
    for (const [name, value] of Object.entries(fields)) req = req.field(name, value);
    if (file)
      req = req.attach('file', file.content, { filename: file.name, contentType: file.type });
    return this.store(await req);
  }

  async fetchCsrf() {
    const response = await this.get('/api/v1/auth/csrf');
    this.csrfToken = (response.body as { csrfToken: string }).csrfToken;
    return response;
  }

  async signIn(email: string, password: string) {
    await this.fetchCsrf();
    const response = await this.send('post', '/api/v1/auth/sign-in', { email, password });
    // The contract asks for a new token after sign-in (§1.1).
    await this.fetchCsrf();
    return response;
  }
}
