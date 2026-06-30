import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'A valid email address is required' })
  email!: string;

  // For login we only require a non-empty password; correctness is checked
  // against the stored hash, not the length.
  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password!: string;
}
