import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ArtifactService } from './artifact.service';
import { CreateArtifactDto } from './dtos/create-artifact.dto';
import { UpdateArtifactDto } from './dtos/update-artifact.dto';

@Controller('artifacts')
export class ArtifactController {
  constructor(private readonly artifactService: ArtifactService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateArtifactDto) {
    const data = await this.artifactService.create(dto);
    return { data };
  }

  @Get()
  async findAll() {
    const data = await this.artifactService.findByWorkspaceId('');
    return { data };
  }

  @Get('workspace/:workspaceId')
  async findByWorkspaceId(@Param('workspaceId') workspaceId: string) {
    const data = await this.artifactService.findByWorkspaceId(workspaceId);
    return { data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.artifactService.findById(id);
    return { data };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateArtifactDto) {
    const data = await this.artifactService.update(id, dto);
    return { data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.artifactService.delete(id);
  }
}
