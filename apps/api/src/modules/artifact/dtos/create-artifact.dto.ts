import { IsString, IsOptional } from 'class-validator';

export class CreateArtifactDto {
  @IsString()
  workspaceId: string;

  @IsString()
  name: string;

  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  format?: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  metadata?: any;
}
