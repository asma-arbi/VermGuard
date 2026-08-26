import { PartialType } from '@nestjs/swagger';
import { CreateDowntimeDto } from './create-downtime.dto';

export class UpdateDowntimeDto extends PartialType(CreateDowntimeDto) {}
