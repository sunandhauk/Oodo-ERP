import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AppUserRecord } from '../../database/types';

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext): AppUserRecord | null => {
  const request = context.switchToHttp().getRequest<{ user?: AppUserRecord }>();
  return request.user ?? null;
});
