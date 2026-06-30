import { IsOptional, IsUUID } from 'class-validator';

/** Optional team filter for the epic list (the epic-management screen). */
export class ListEpicsQueryDto {
  @IsOptional()
  @IsUUID()
  teamId?: string;
}
