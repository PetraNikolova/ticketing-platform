import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Team } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Team[]> {
    return this.prisma.team.findMany({ orderBy: { name: 'asc' } });
  }

  async create(dto: CreateTeamDto): Promise<Team> {
    await this.assertNameAvailable(dto.name);
    try {
      return await this.prisma.team.create({ data: { name: dto.name } });
    } catch (err) {
      throw this.mapNameConflict(err);
    }
  }

  async rename(id: string, dto: UpdateTeamDto): Promise<Team> {
    const team = await this.getOrThrow(id);
    // No-op rename: nothing changed, so don't advance modifiedAt.
    if (team.name === dto.name) {
      return team;
    }
    await this.assertNameAvailable(dto.name, id);
    try {
      return await this.prisma.team.update({
        where: { id },
        data: { name: dto.name },
      });
    } catch (err) {
      throw this.mapNameConflict(err);
    }
  }

  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);

    // Spec: a team cannot be deleted while it contains epics or tickets, and
    // cascading deletion is not allowed. Check explicitly for a clear message.
    const [epics, tickets] = await Promise.all([
      this.prisma.epic.count({ where: { teamId: id } }),
      this.prisma.ticket.count({ where: { teamId: id } }),
    ]);
    if (epics > 0 || tickets > 0) {
      throw new ConflictException(
        'This team cannot be deleted while it contains epics or tickets',
      );
    }

    try {
      await this.prisma.team.delete({ where: { id } });
    } catch (err) {
      // Safety net against a concurrent insert between the count and the
      // delete: the Restrict foreign key surfaces as P2003.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2003'
      ) {
        throw new ConflictException(
          'This team cannot be deleted while it contains epics or tickets',
        );
      }
      throw err;
    }
  }

  private async getOrThrow(id: string): Promise<Team> {
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    return team;
  }

  /**
   * Case-insensitive name check for a friendly 409 message. The functional
   * unique index lower(name) is the hard guarantee; this is the kind path.
   */
  private async assertNameAvailable(
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const existing = await this.prisma.team.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('A team with this name already exists');
    }
  }

  /** Maps the unique-index violation (race winner) to a 409. */
  private mapNameConflict(err: unknown): unknown {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return new ConflictException('A team with this name already exists');
    }
    return err;
  }
}
