import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import { validationExceptionFactory } from './validation-exception.factory.js';

// Validates a body inside a service, for endpoints where the contract checks
// visibility, status, and revision before field validation
// (API_CONTRACT.md §1.4). Same rules as the global ValidationPipe.
export async function validateBody<T extends object>(
  dtoClass: ClassConstructor<T>,
  body: unknown,
): Promise<T> {
  const instance = plainToInstance(dtoClass, body ?? {});
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length > 0) throw validationExceptionFactory(errors);
  return instance;
}
