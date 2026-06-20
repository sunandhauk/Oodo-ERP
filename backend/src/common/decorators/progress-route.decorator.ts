import { SetMetadata } from '@nestjs/common';

export const PROGRESS_ROUTE_KEY = 'progressRoute';
export const ProgressRoute = () => SetMetadata(PROGRESS_ROUTE_KEY, true);
