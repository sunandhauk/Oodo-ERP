import { Controller, Get, Module, Post, Body } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestStatus } from '../../common/enums/request-status.enum';
import { AppUserRecord } from '../../database/types';
import { RequestContextService } from '../../common/context/request-context.service';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Permissions('auth.read')
  @Get('me')
  me(@CurrentUser() user: AppUserRecord | null) {
    return {
      status: RequestStatus.Success,
      requestId: this.requestContext.getRequestId(),
      data: user,
      error: null,
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
