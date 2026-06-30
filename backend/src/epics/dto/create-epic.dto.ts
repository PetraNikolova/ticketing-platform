import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateEpicDto {
  // The owning team is chosen here and is immutable afterwards (no teamId in
  // UpdateEpicDto), per the spec.
  @IsUUID()
  teamId!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1, { message: 'Epic title must not be empty' })
  title!: string;

  // Optional free text; blank/whitespace is normalised to null (no description).
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
