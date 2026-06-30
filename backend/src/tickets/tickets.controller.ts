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
import { Ticket } from '@prisma/client';
import { TicketsService, TicketDetail } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { UpdateTicketStateDto } from './dto/update-ticket-state.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

// Protected by the global AuthGuard — all ticket routes require a session.
@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  findAll(@Query() query: ListTicketsQueryDto): Promise<Ticket[]> {
    return this.tickets.findAll(query);
  }

  @Post()
  @HttpCode(201)
  create(
    @Body() dto: CreateTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Ticket> {
    return this.tickets.create(dto, user.userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<TicketDetail> {
    return this.tickets.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
  ): Promise<Ticket> {
    return this.tickets.update(id, dto);
  }

  @Patch(':id/state')
  updateState(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketStateDto,
  ): Promise<Ticket> {
    return this.tickets.updateState(id, dto.state);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.tickets.remove(id);
  }
}
