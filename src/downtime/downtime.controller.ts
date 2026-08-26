import { Controller, Get, Post, Patch, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DowntimeService } from './downtime.service';
import { CreateDowntimeDto } from './dto/create-downtime.dto';
import { UpdateDowntimeDto } from './dto/update-downtime.dto';
import { Downtime } from './entities/downtime.entity';

@ApiTags('Downtime')
@Controller('downtime')
export class DowntimeController {
  constructor(private readonly downtimeService: DowntimeService) {}

  @Get()
  @ApiOperation({ summary: 'Get all downtime records' })
  async findAll(): Promise<Downtime[]> {
    return this.downtimeService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a downtime record by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Downtime> {
    return this.downtimeService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new downtime record' })
  async create(@Body() createDowntimeDto: CreateDowntimeDto): Promise<Downtime> {
    return this.downtimeService.create(createDowntimeDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a downtime record' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDowntimeDto: UpdateDowntimeDto,
  ): Promise<Downtime> {
    return this.downtimeService.update(id, updateDowntimeDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a downtime record' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.downtimeService.remove(id);
  }
}
