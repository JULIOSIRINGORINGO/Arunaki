import { IsString, IsOptional } from 'class-validator';

export class UpdateArtifactDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  metadata?: any;
}
