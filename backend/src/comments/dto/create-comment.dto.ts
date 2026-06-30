import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';

export class CreateCommentDto {
  // Trimmed; must be non-empty. Comments are immutable once created.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1, { message: 'Comment body must not be empty' })
  body!: string;
}
