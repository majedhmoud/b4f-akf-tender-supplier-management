import type { ValidationError } from '@nestjs/common';
import { validationExceptionFactory } from './validation-exception.factory.js';

// Pins the field paths and codes the web app shows inline
// (API_CONTRACT.md §1.5), including nested array paths.
describe('validationExceptionFactory', () => {
  it('maps missing, extra, and invalid fields to their codes and paths', () => {
    const errors: ValidationError[] = [
      { property: 'email', constraints: { isNotEmpty: 'email should not be empty' } },
      { property: 'deadlines', constraints: { whitelistValidation: 'should not exist' } },
      {
        property: 'translations',
        children: [
          {
            property: '0',
            children: [{ property: 'title', constraints: { maxLength: 'too long' } }],
          },
        ],
      },
    ];

    const exception = validationExceptionFactory(errors);

    expect(exception.getStatus()).toBe(400);
    expect(exception.code).toBe('VALIDATION_FAILED');
    expect(exception.fields).toEqual([
      { field: 'email', code: 'REQUIRED' },
      { field: 'deadlines', code: 'FIELD_NOT_EDITABLE' },
      { field: 'translations[0].title', code: 'INVALID' },
    ]);
  });
});
