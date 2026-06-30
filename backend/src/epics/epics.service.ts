import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Epic, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEpicDto } from './dto/create-epic.dto';
import { UpdateEpicDto } from './dto/update-epic.dto';

@Injectable()
export class EpicsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(teamId?: string): Promise<Epic[]> {
    return this.prisma.epic.findMany({
      where: teamId ? { teamId } : {},
      orderBy: { title: 'asc' },
    });
  }

  async create(dto: CreateEpicDto): Promise<Epic> {
    await this.assertTeamExists(dto.teamId);
    return this.prisma.epic.create({
      data: {
        teamId: dto.teamId,
        title: dto.title,
        description: dto.description ?? null,
      },
    });
  }

  async update(id: string, dto: UpdateEpicDto): Promise<Epic> {
    const epic = await this.getOrThrow(id);

    // Build a change set of only the fields that actually differ, so a no-op
    // save does not advance modifiedAt. An omitted field is left unchanged.
    const data: Prisma.EpicUpdateInput = {};
    if (dto.title !== undefined && dto.title !== epic.title) {
      data.title = dto.title;
    }
    if (dto.description !== undefined && dto.description !== epic.description) {
      data.description = dto.description;
    }

    if (Object.keys(data).length === 0) {
      return epic;
    }
    return this.prisma.epic.update({ where: { id }, data });
  }

  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);

    // Spec: an epic cannot be deleted while tickets reference it.
    const referencing = await this.prisma.ticket.count({
      where: { epicId: id },
    });
    if (referencing > 0) {
      throw new ConflictException(
        'This epic cannot be deleted while tickets reference it',
      );
    }

    try {
      await this.prisma.epic.delete({ where: { id } });
    } catch (err) {
      // Safety net against a concurrent insert: the Restrict FK surfaces P2003.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2003'
      ) {
        throw new ConflictException(
          'This epic cannot be deleted while tickets reference it',
        );
      }
      throw err;
    }
  }

  private async getOrThrow(id: string): Promise<Epic> {
    const epic = await this.prisma.epic.findUnique({ where: { id } });
    if (!epic) {
      throw new NotFoundException('Epic not found');
    }
    return epic;
  }

  private async assertTeamExists(teamId: string): Promise<void> {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new BadRequestException('Referenced team does not exist');
    }
  }
}
