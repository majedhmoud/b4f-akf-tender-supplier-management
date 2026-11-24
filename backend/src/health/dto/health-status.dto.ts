import { ApiProperty } from '@nestjs/swagger';

export class HealthStatus {
  @ApiProperty({ enum: ['ok'], example: 'ok' })
  status: 'ok';

  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  database: 'up' | 'down';
}
