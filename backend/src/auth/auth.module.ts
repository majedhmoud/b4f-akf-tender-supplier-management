import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AccessService } from './access.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthSettings } from './auth.settings.js';
import { CsrfGuard } from './csrf.guard.js';
import { CsrfService } from './csrf.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { JwtStrategy } from './jwt.strategy.js';
import { MobileAuthController } from './mobile-auth.controller.js';

// Authentication and authorization module (ENGINEERING_STANDARDS.md §1.1).
// The two global guards run in this order: session first, then CSRF, so an
// expired session answers 401 before anything else (API_CONTRACT.md §1.4).
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      extraProviders: [AuthSettings],
      inject: [AuthSettings],
      useFactory: (settings: AuthSettings) => ({ secret: settings.jwtSecret }),
    }),
  ],
  controllers: [AuthController, MobileAuthController],
  providers: [
    AuthSettings,
    AuthService,
    AccessService,
    CsrfService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
  exports: [AuthService, AccessService, CsrfService],
})
export class AuthModule {}
