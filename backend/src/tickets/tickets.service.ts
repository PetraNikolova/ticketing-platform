import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Ticket } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';

/** Ticket detail includes the author (id + email) for the details view. */
export type TicketDetail = Prisma.TicketGetPayload<{
  include: { createdBy: { select: { id: true; email: true } } };
}>;

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filters: ListTicketsQueryDto): Promise<Ticket[]> {
    const { teamId, type, epicId, q } = filters;
    return this.prisma.ticket.findMany({
      where: {
        ...(teamId ? { teamId } : {}),
        ...(type ? { type } : {}),
        ...(epicId ? { epicId } : {}),
        ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
      },
      // Board ordering: within each state column, most recently modified first.
      orderBy: { modifiedAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<TicketDetail> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, email: true } } },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
  }

  async create(dto: CreateTicketDto, userId: string): Promise<Ticket> {
    await this.assertTeamExists(dto.teamId);
    if (dto.epicId) {
      await this.assertEpicMatchesTeam(dto.epicId, dto.teamId);
    }

    return this.prisma.ticket.create({
      data: {
        teamId: dto.teamId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        epicId: dto.epicId ?? null,
        createdById: userId,
        // Omitted → DB default `new`.
        ...(dto.state ? { state: dto.state } : {}),
      },
    });
  }

  async update(id: string, dto: UpdateTicketDto): Promise<Ticket> {
    const ticket = await this.getOrThrow(id);

    // Resolve the post-update team/epic to validate the relationship. An
    // omitted epicId leaves the existing one; an explicit null clears it.
    const nextTeamId = dto.teamId ?? ticket.teamId;
    const nextEpicId = dto.epicId === undefined ? ticket.epicId : dto.epicId;

    if (dto.teamId !== undefined && dto.teamId !== ticket.teamId) {
      await this.assertTeamExists(dto.teamId);
    }
    if (nextEpicId) {
      // Rejects a cross-team epic — including the case where the team changed
      // but the previously selected epic was not cleared or replaced.
      await this.assertEpicMatchesTeam(nextEpicId, nextTeamId);
    }

    // Change set of only the fields that actually differ, so a no-op save does
    // not advance modifiedAt (@updatedAt bumps on every real update call).
    const data: Prisma.TicketUncheckedUpdateInput = {};
    if (dto.title !== undefined && dto.title !== ticket.title) {
      data.title = dto.title;
    }
    if (dto.body !== undefined && dto.body !== ticket.body) {
      data.body = dto.body;
    }
    if (dto.type !== undefined && dto.type !== ticket.type) {
      data.type = dto.type;
    }
    if (dto.state !== undefined && dto.state !== ticket.state) {
      data.state = dto.state;
    }
    if (dto.teamId !== undefined && dto.teamId !== ticket.teamId) {
      data.teamId = dto.teamId;
    }
    if (nextEpicId !== ticket.epicId) {
      data.epicId = nextEpicId;
    }

    if (Object.keys(data).length === 0) {
      return ticket;
    }
    return this.prisma.ticket.update({ where: { id }, data });
  }

  async updateState(id: string, state: Ticket['state']): Promise<Ticket> {
    const ticket = await this.getOrThrow(id);
    // No-op (dropped back in the same column) must not advance modifiedAt.
    if (ticket.state === state) {
      return ticket;
    }
    return this.prisma.ticket.update({ where: { id }, data: { state } });
  }

  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    // Comments cascade on delete (schema onDelete: Cascade).
    await this.prisma.ticket.delete({ where: { id } });
  }

  private async getOrThrow(id: string): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
  }

  private async assertTeamExists(teamId: string): Promise<void> {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true },
    });
    if (!team) {
      throw new BadRequestException('Referenced team does not exist');
    }
  }

  private async assertEpicMatchesTeam(
    epicId: string,
    teamId: string,
  ): Promise<void> {
    const epic = await this.prisma.epic.findUnique({
      where: { id: epicId },
      select: { teamId: true },
    });
    if (!epic) {
      throw new BadRequestException('Referenced epic does not exist');
    }
    if (epic.teamId !== teamId) {
      throw new BadRequestException(
        'The selected epic belongs to a different team',
      );
    }
  }
}
