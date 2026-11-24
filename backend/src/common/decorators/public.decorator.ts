import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Every endpoint requires a session unless it is marked public. Deny by
// default (ENGINEERING_STANDARDS.md §2.2).
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
