import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

/** A comment with its author (id + email) for display. */
export type CommentWithAuthor = Prisma.CommentGetPayload<{
  include: { author: { select: { id: true; email: true } } };
}>;

const withAuthor = {
  author: { select: { id: true, email: true } },
} as const;

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ticketId: string): Promise<CommentWithAuthor[]> {
    await this.assertTicketExists(ticketId);
    return this.prisma.comment.findMany({
      where: { ticketId },
      // Chronological, oldest first.
      orderBy: { createdAt: 'asc' },
      include: withAuthor,
    });
  }

  async add(
    ticketId: string,
    authorId: string,
    dto: CreateCommentDto,
  ): Promise<CommentWithAuthor> {
    await this.assertTicketExists(ticketId);
    // Inserting a comment never touches the ticket row, so the ticket's
    // modifiedAt (and therefore its board ordering) is unaffected.
    return this.prisma.comment.create({
      data: { ticketId, authorId, body: dto.body },
      include: withAuthor,
    });
  }

  private async assertTicketExists(ticketId: string): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
  }
}
