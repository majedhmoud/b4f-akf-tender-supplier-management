import { ArgumentsHost, NotFoundException } from '@nestjs/common';
import { ApiException } from '../errors/api-exception.js';
import { ApiExceptionFilter } from './api-exception.filter.js';

// Pins the error envelope every endpoint returns (API_CONTRACT.md §1.5), and
// that unexpected errors never leak their message.
describe('ApiExceptionFilter', () => {
  function run(exception: unknown) {
    const json = vi.fn((_body: unknown) => undefined);
    const status = vi.fn((_code: number) => ({ json }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status, setHeader: vi.fn() }),
        getRequest: () => ({ requestId: 'req_test' }),
      }),
    } as unknown as ArgumentsHost;

    new ApiExceptionFilter().catch(exception, host);
    return { status: status.mock.calls[0][0], body: json.mock.calls[0][0] };
  }

  it('shapes an ApiException into the envelope', () => {
    const result = run(new ApiException(403, 'ACCOUNT_DISABLED', 'Account disabled'));

    expect(result.status).toBe(403);
    expect(result.body).toEqual({
      error: {
        code: 'ACCOUNT_DISABLED',
        message: 'Account disabled',
        details: {},
        requestId: 'req_test',
      },
    });
  });

  it('gives framework errors a contract code', () => {
    const result = run(new NotFoundException('Cannot GET /api/v1/nothing'));

    expect(result.status).toBe(404);
    expect(result.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('hides the message of an unexpected error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = run(new Error('database password is hunter2'));

    expect(result.status).toBe(500);
    expect(result.body).toMatchObject({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
    expect(JSON.stringify(result.body)).not.toContain('hunter2');
  });
});
