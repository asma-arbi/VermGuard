import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Downtime } from './entities/downtime.entity';
import { CreateDowntimeDto } from './dto/create-downtime.dto';
import { UpdateDowntimeDto } from './dto/update-downtime.dto';

@Injectable()
export class DowntimeService {
  constructor(
    @InjectRepository(Downtime)
    private readonly downtimeRepository: Repository<Downtime>,
  ) {}

  async findAll(): Promise<Downtime[]> {
    return this.downtimeRepository.find({
      order: {
        startTime: 'DESC',
      },
    });
  }

  async findOne(id: number): Promise<Downtime> {
    const record = await this.downtimeRepository.findOneBy({ id });
    if (!record) {
      throw new NotFoundException(`Downtime record with ID ${id} not found.`);
    }
    return record;
  }

  async create(createDowntimeDto: CreateDowntimeDto): Promise<Downtime> {
    const record = this.downtimeRepository.create({
      ...createDowntimeDto,
      startTime: new Date(createDowntimeDto.startTime),
      endTime: new Date(createDowntimeDto.endTime),
    });
    return this.downtimeRepository.save(record);
  }

  async update(id: number, updateDowntimeDto: UpdateDowntimeDto): Promise<Downtime> {
    const record = await this.findOne(id);
    
    const updatedData: any = { ...updateDowntimeDto };
    if (updateDowntimeDto.startTime) {
      updatedData.startTime = new Date(updateDowntimeDto.startTime);
    }
    if (updateDowntimeDto.endTime) {
      updatedData.endTime = new Date(updateDowntimeDto.endTime);
    }

    Object.assign(record, updatedData);
    return this.downtimeRepository.save(record);
  }

  async remove(id: number): Promise<void> {
    const record = await this.findOne(id);
    await this.downtimeRepository.remove(record);
  }
}
