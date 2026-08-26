import { IsString, IsOptional, IsIn, MinLength } from 'class-validator';

export class CreateSourceDto {
  @IsString()
  @MinLength(1)
  workspaceId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @IsIn(['folder', 'file', 'upload', 'gdrive', 'onedrive'])
  type: string;

  @IsString()
  @IsOptional()
  path?: string;
}

export class UpdateSourceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  path?: string;
}
