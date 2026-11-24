import { Module } from '@nestjs/common';
import { SetupTokens } from './setup-tokens.js';

// Shared by U7 (issues the first link), account setup (checks and reissues
// links), and the email worker (puts the link into the email).
@Module({ providers: [SetupTokens], exports: [SetupTokens] })
export class SetupTokensModule {}
