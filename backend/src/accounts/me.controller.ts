import { Body, Controller, Patch } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SessionUser } from '../auth/dto/session-view.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { AccountsService } from './accounts.service.js';
import { UpdateMeDto } from './dto/update-me.dto.js';

// A5 belongs to the Auth tag in API_CONTRACT.md §2; it lives in the Accounts
// module because it changes the account.
@ApiTags('Auth')
@ApiCookieAuth()
@Controller('me')
export class MeController {
  constructor(private readonly accountsService: AccountsService) {}

  @Patch()
  @ApiOkResponse({ type: SessionUser })
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMeDto): Promise<SessionUser> {
    return this.accountsService.updateMe(user.id, dto);
  }
}
