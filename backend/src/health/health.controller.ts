import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { HealthStatus } from './dto/health-status.dto.js';
import { HealthService } from './health.service.js';

// Public: no session needed. See API_CONTRACT.md, "System".
@Public()
@ApiTags('System')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({ type: HealthStatus })
  check(): Promise<HealthStatus> {
    return this.healthService.check();
  }
}
