import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { TicketState, TicketType } from '@prisma/client';

export class CreateTicketDto {
  // The board the ticket belongs to. Must reference an existing team.
  @IsUUID()
  teamId!: string;

  @IsEnum(TicketType)
  type!: TicketType;

  // Optional on create; the column defaults to `new` when omitted.
  @IsOptional()
  @IsEnum(TicketState)
  state?: TicketState;

  // Null or a UUID; when set, the epic must belong to the same team (enforced
  // in the service). @IsOptional skips validation for null/undefined.
  @IsOptional()
  @IsUUID()
  epicId?: string | null;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1, { message: 'Title must not be empty' })
  title!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1, { message: 'Body must not be empty' })
  body!: string;
}
