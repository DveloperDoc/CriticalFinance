import { Module } from '@nestjs/common';
import { MlService } from './ml.service';

@Module({
  providers: [MlService],
  exports: [MlService],
})
export class MlModule {}
