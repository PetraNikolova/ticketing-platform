import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Epic } from '@prisma/client';
import { EpicsService } from './epics.service';
import { CreateEpicDto } from './dto/create-epic.dto';
import { UpdateEpicDto } from './dto/update-epic.dto';
import { ListEpicsQueryDto } from './dto/list-epics-query.dto';

// Protected by the global AuthGuard — all epic routes require a session.
@Controller('epics')
export class EpicsController {
  constructor(private readonly epics: EpicsService) {}

  @Get()
  findAll(@Query() query: ListEpicsQueryDto): Promise<Epic[]> {
    return this.epics.findAll(query.teamId);
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateEpicDto): Promise<Epic> {
    return this.epics.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEpicDto,
  ): Promise<Epic> {
    return this.epics.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.epics.remove(id);
  }
}
