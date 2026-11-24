import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AccountSetupModule } from './account-setup/account-setup.module.js';
import { AccountsModule } from './accounts/accounts.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CacheControlInterceptor } from './common/http/cache-control.js';
import { HealthModule } from './health/health.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReferenceModule } from './reference/reference.module.js';
import { SupplierSignUpModule } from './supplier-sign-up/supplier-sign-up.module.js';
import { SuppliersModule } from './suppliers/suppliers.module.js';
import { CommitteesModule } from './committees/committees.module.js';
import { BidsModule } from './bids/bids.module.js';
import { LifecycleModule } from './lifecycle/lifecycle.module.js';
import { EvaluationsModule } from './evaluations/evaluations.module.js';
import { OfficerEmailsModule } from './officer-emails/officer-emails.module.js';
import { TendersModule } from './tenders/tenders.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Used only where a route opts in with ThrottlerGuard: sign-in, for now.
    // Named "default" so the response header is a plain Retry-After.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          { name: 'default', ttl: 60_000, limit: Number(config.get('SIGN_IN_RATE_LIMIT', 5)) },
        ],
      }),
    }),
    // Redis for the email queue (ADR 0004). QUEUE_PREFIX keeps test runs apart.
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>('REDIS_URL', 'redis://localhost:6379') },
        prefix: config.get<string>('QUEUE_PREFIX', 'akf'),
      }),
    }),
    PrismaModule,
    AuthModule,
    AccountsModule,
    TendersModule,
    ReferenceModule,
    HealthModule,
    SupplierSignUpModule,
    NotificationsModule,
    AccountSetupModule,
    SuppliersModule,
    CommitteesModule,
    BidsModule,
    LifecycleModule,
    EvaluationsModule,
    OfficerEmailsModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: CacheControlInterceptor }],
})
export class AppModule {}
