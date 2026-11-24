import { assertLocalDatabase } from './seed-safety.js';

// Pins the seed's safety gate: it only ever runs against a local database.
describe('assertLocalDatabase', () => {
  it('allows a database on this machine', () => {
    expect(() =>
      assertLocalDatabase('postgresql://me@localhost:5432/akf_tender?schema=public'),
    ).not.toThrow();
    expect(() => assertLocalDatabase('postgresql://me@127.0.0.1/akf_tender')).not.toThrow();
  });

  it('refuses a remote database, a missing URL, and a malformed one', () => {
    expect(() => assertLocalDatabase('postgresql://me@db.example.com/akf')).toThrow(/Refusing/);
    expect(() => assertLocalDatabase(undefined)).toThrow(/not set/);
    expect(() => assertLocalDatabase('not a url')).toThrow(/not a valid URL/);
  });
});
