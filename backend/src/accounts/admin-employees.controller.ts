import { Body, Controller, Post, Req } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { RequireRole } from '../auth/require-role.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { CreateEmployeeDto, CreatedEmployee } from './dto/create-employee.dto.js';
import { EmployeeAccountsService } from './employee-accounts.service.js';

@ApiTags('Employee Accounts')
@ApiCookieAuth()
@RequireRole('admin')
@Controller('admin/employees')
export class AdminEmployeesController {
  constructor(private readonly employees: EmployeeAccountsService) {}

  @Post()
  @ApiCreatedResponse({ type: CreatedEmployee })
  @ApiNotFoundResponse({ description: 'NOT_FOUND for a signed-in user without the admin role.' })
  @ApiConflictResponse({ description: 'EMAIL_ALREADY_REGISTERED.' })
  create(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreateEmployeeDto,
    @Req() req: Request,
  ): Promise<CreatedEmployee> {
    return this.employees.create(admin.id, dto, req.requestId);
  }
}
