import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TicketType } from '@prisma/client';

/**
 * Board filters, all optional and AND-combined server-side:
 * team, type, epic, and a case-insensitive substring search over the title.
 */
export class ListTicketsQueryDto {
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsEnum(TicketType)
  type?: TicketType;

  @IsOptional()
  @IsUUID()
  epicId?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  q?: string;
}
