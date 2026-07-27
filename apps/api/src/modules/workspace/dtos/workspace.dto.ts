import { IsString, IsOptional, MinLength } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  businessType?: string;

  @IsString()
  @IsOptional()
  rootPath?: string;
}

export class UpdateWorkspaceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
