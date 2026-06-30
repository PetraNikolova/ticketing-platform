import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';

export class CreateTeamDto {
  // Trim before validation so " " is rejected and stored names are clean.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1, { message: 'Team name must not be empty' })
  name!: string;
}
