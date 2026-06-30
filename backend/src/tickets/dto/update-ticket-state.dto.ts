import { IsEnum } from 'class-validator';
import { TicketState } from '@prisma/client';

/** Dedicated payload for drag-and-drop state changes (PATCH /tickets/:id/state). */
export class UpdateTicketStateDto {
  @IsEnum(TicketState)
  state!: TicketState;
}
