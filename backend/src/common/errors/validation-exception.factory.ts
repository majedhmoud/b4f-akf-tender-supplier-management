import { HttpStatus, ValidationError } from '@nestjs/common';
import { ApiException, FieldError } from './api-exception.js';

// Field codes for class-validator constraints. Anything not listed is INVALID.
// FIELD_NOT_EDITABLE covers fields a request may not send at all, such as
// deadlines on a draft tender (API_CONTRACT.md, Employee Tenders).
const CONSTRAINT_CODES: Record<string, string> = {
  isDefined: 'REQUIRED',
  isNotEmpty: 'REQUIRED',
  whitelistValidation: 'FIELD_NOT_EDITABLE',
};

function toFieldErrors(errors: ValidationError[], parentPath = ''): FieldError[] {
  return errors.flatMap((error) => {
    const isIndex = /^\d+$/.test(error.property);
    const path = isIndex
      ? `${parentPath}[${error.property}]`
      : parentPath
        ? `${parentPath}.${error.property}`
        : error.property;

    const own = Object.keys(error.constraints ?? {}).map((constraint) => ({
      field: path,
      code: CONSTRAINT_CODES[constraint] ?? 'INVALID',
    }));

    return [...own, ...toFieldErrors(error.children ?? [], path)];
  });
}

// Used by the global ValidationPipe, so every invalid body returns
// 400 VALIDATION_FAILED with fields[] (API_CONTRACT.md §1.5).
export function validationExceptionFactory(errors: ValidationError[]): ApiException {
  return new ApiException(
    HttpStatus.BAD_REQUEST,
    'VALIDATION_FAILED',
    'Request validation failed',
    toFieldErrors(errors),
  );
}
