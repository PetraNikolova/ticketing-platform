import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CommentsService, CommentWithAuthor } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

// Nested under a ticket; protected by the global AuthGuard.
@Controller('tickets/:ticketId/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  list(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ): Promise<CommentWithAuthor[]> {
    return this.comments.list(ticketId);
  }

  @Post()
  @HttpCode(201)
  add(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CommentWithAuthor> {
    return this.comments.add(ticketId, user.userId, dto);
  }
}
