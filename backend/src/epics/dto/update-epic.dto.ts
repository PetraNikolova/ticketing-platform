import { Transform } from 'class-transformer';
import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Title and/or description only. `teamId` is intentionally absent: an epic's
 * team is immutable, and the global ValidationPipe (forbidNonWhitelisted)
 * rejects any attempt to send it. An omitted field is left unchanged; an
 * explicit empty/whitespace description clears it (stored as null).
 */
export class UpdateEpicDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Epic title must not be empty' })
  title?: string;

  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  })
  @IsOptional()
  @IsString()
  description?: string | null;
}
