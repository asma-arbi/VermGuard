import { IsNotEmpty, IsString, IsDateString, IsNumber } from 'class-validator';

export class CreateDowntimeDto {
  @IsNotEmpty()
  @IsString()
  organizationName!: string;

  @IsNotEmpty()
  @IsDateString()
  startTime!: string;

  @IsNotEmpty()
  @IsDateString()
  endTime!: string;

  @IsNotEmpty()
  @IsNumber()
  duration!: number;

  @IsNotEmpty()
  @IsString()
  createdBy!: string;
}
