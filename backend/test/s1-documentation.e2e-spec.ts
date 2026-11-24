import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { OpenAPIObject } from '@nestjs/swagger';
import { readFile, writeFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { createApiDocument } from '../src/common/swagger/swagger.util.js';

type OperationObject = NonNullable<OpenAPIObject['paths'][string]['get']>;

type Item = {
  item?: Item[];
  request?: {
    method: string;
    url: { raw: string };
    header: { key: string; value: string }[];
    body?: { mode: string; raw?: string };
  };
  event?: { script: { exec: string[] } }[];
};
type Collection = {
  info: { schema: string };
  auth: { type: string };
  variable: { key: string; value: string }[];
  event: { script: { exec: string[] } }[];
  item: Item[];
};
async function loadCollection(): Promise<Collection> {
  const text = await readFile(
    new URL(
      '../../docs/postman/b4f-akf-tender-supplier-management.postman_collection.json',
      import.meta.url,
    ),
    'utf8',
  );
  return JSON.parse(text) as Collection;
}
function requests(items: Item[]): NonNullable<Item['request']>[] {
  return items.flatMap((item) => (item.request ? [item.request] : requests(item.item ?? [])));
}

// Detects drift between the runnable hand-in collection and the real Swagger DTOs.
// See SUBMISSION_REQUIREMENTS.md, Back-end API documentation.
describe('S1 API documentation (e2e)', () => {
  let app: INestApplication;
  let document: OpenAPIObject;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    document = createApiDocument(app);
    // Optional local export for regenerating the collection; never writes into Git.
    if (process.env.S1_OPENAPI_EXPORT)
      await writeFile(process.env.S1_OPENAPI_EXPORT, JSON.stringify(document, null, 2));
  });
  afterAll(async () => {
    await app.close();
  });
  it('documents every S1 area and the required request/response DTOs', () => {
    const operations = Object.values(document.paths).flatMap((path) =>
      Object.entries(path ?? {})
        .filter(([method]) => ['get', 'post', 'patch', 'put', 'delete'].includes(method))
        .map(([, operation]) => operation as OperationObject),
    );
    const tags = new Set(operations.flatMap((operation) => operation.tags ?? []));
    for (const tag of [
      'System',
      'Auth',
      'Employee Tenders',
      'Tender Management',
      'Public Tenders',
      'Reference',
    ])
      expect(tags.has(tag), tag).toBe(true);
    for (const operation of operations)
      expect(Object.keys(operation.responses ?? {}).length, operation.operationId).toBeGreaterThan(
        0,
      );
    for (const name of [
      'SignInDto',
      'CreateDraftTenderDto',
      'AcceptTenderDto',
      'UpdateManagedTenderDto',
      'PublishTenderDto',
      'SaveBidFormDto',
      'ManagedTender',
      'PublicTender',
    ])
      expect(document.components?.schemas?.[name], name).toBeDefined();
  });
  it('documents common errors, upload failures, and sign-in retry timing', () => {
    const signIn = document.paths['/api/v1/auth/sign-in'].post!;
    for (const code of ['400', '401', '403', '429', '500'])
      expect(signIn.responses[code], code).toBeDefined();
    const upload = document.paths['/api/v1/manage/tenders/{tenderId}/documents'].post!;
    for (const code of ['401', '403', '404', '413', '415'])
      expect(upload.responses[code], code).toBeDefined();
    expect(document.components?.schemas?.ApiErrorEnvelope).toBeDefined();
    expect(signIn.responses['429']).toHaveProperty('headers.Retry-After');
  });
  it('includes every implemented operation in the Postman v2.1 hand-in collection', async () => {
    const collection = await loadCollection();
    expect(collection.info.schema).toBe(
      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    );
    const actual = new Set(
      requests(collection.item).map(
        (request) =>
          `${request.method.toLowerCase()} ${request.url.raw
            .replace('{{baseUrl}}', '')
            .split('?')[0]
            .replace(/\{\{([^}]+)\}\}/g, '{$1}')}`,
      ),
    );
    for (const [path, entry] of Object.entries(document.paths))
      for (const method of Object.keys(entry ?? {})) {
        if (['get', 'post', 'patch', 'put', 'delete'].includes(method))
          expect(actual.has(`${method} ${path}`), `${method} ${path}`).toBe(true);
      }
  });
  it('keeps examples parseable and collection scripts executable', async () => {
    const collection = await loadCollection();
    const inspect = (items: Item[]) => {
      for (const item of items) {
        if (item.request?.body?.mode === 'raw')
          expect((): unknown =>
            JSON.parse(item.request!.body!.raw!.replaceAll('{{revision}}', '1')),
          ).not.toThrow();
        for (const event of item.event ?? [])
          expect(
            () => new Script('(async () => {' + event.script.exec.join('\n') + '})()'),
          ).not.toThrow();
        if (item.item) inspect(item.item);
      }
    };
    inspect(collection.item);
    const values = new Map([
      ['baseUrl', 'http://localhost:4000'],
      ['language', 'ar'],
    ]);
    const sendRequest = vi
      .fn()
      .mockResolvedValue({ code: 200, json: () => ({ csrfToken: 'ephemeral-test-token' }) });
    const script = new Script(
      '(async () => {' + collection.event[0].script.exec.join('\n') + '})()',
    );
    await script.runInNewContext({
      pm: {
        request: { method: 'POST' },
        sendRequest,
        variables: {
          get: (key: string) => values.get(key),
          set: (key: string, value: string) => values.set(key, value),
        },
      },
    });
    expect(sendRequest).toHaveBeenCalledWith({
      url: 'http://localhost:4000/api/v1/auth/csrf',
      method: 'GET',
      header: { 'Accept-Language': 'ar' },
    });
    expect(values.get('csrfToken')).toBe('ephemeral-test-token');
  });
  it('parameterizes authentication and supplies CSRF on every write', async () => {
    const collection = await loadCollection();
    expect(collection.auth.type).toBe('noauth'); // Postman cookie jar handles HttpOnly session cookies.
    for (const key of ['password', 'csrfToken'])
      expect(collection.variable.find((variable) => variable.key === key)?.value).toBe('');
    for (const request of requests(collection.item)) {
      expect(
        request.url.raw.startsWith('{{baseUrl}}/api/v1/') ||
          request.url.raw === '{{baseUrl}}{{signedDownloadPath}}',
      ).toBe(true);
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method))
        expect(request.header).toContainEqual({ key: 'X-CSRF-Token', value: '{{csrfToken}}' });
    }
  });
});
