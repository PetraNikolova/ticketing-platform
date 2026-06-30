import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { TicketState, TicketType } from '@prisma/client';

/**
 * All fields optional (partial edit). An omitted field is left unchanged; a
 * no-op save does not advance modifiedAt. `epicId: null` clears the epic.
 * Changing `teamId` while an incompatible epic remains is rejected by the
 * service (cross-team epics are not allowed).
 */
export class UpdateTicketDto {
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsEnum(TicketType)
  type?: TicketType;

  @IsOptional()
  @IsEnum(TicketState)
  state?: TicketState;

  @IsOptional()
  @IsUUID()
  epicId?: string | null;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Title must not be empty' })
  title?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Body must not be empty' })
  body?: string;
}
