import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/providers/prisma.module';
import { ArtifactRepository } from './artifact.repository';
import { ArtifactService } from './artifact.service';
import { ArtifactController } from './artifact.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ArtifactController],
  providers: [ArtifactRepository, ArtifactService],
  exports: [ArtifactService],
})
export class ArtifactModule {}
