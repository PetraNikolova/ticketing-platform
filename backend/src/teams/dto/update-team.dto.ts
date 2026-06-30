import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';

/** Rename is the only mutable team field; team contents are managed elsewhere. */
export class UpdateTeamDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1, { message: 'Team name must not be empty' })
  name!: string;
}
