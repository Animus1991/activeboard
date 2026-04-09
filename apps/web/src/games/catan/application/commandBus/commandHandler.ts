import { CatanMatchState, UnixMs } from '../../domain/model/catanMatchState';
import { CatanDomainEventEnvelope } from '../../domain/model/catanMatchState';
import { CatanCommandEnvelope } from '../../domain/commands/commandEnvelope';

export interface CommandHandlerContext<T = any> {
  state: CatanMatchState;
  envelope: CatanCommandEnvelope & { command: T };
  now: UnixMs;
  rng: { int: (min: number, max: number) => number };
}

export interface CommandHandlingResult {
  accepted: boolean;
  events: CatanDomainEventEnvelope[];
  rejection?: {
    code: string;
    message: string;
  };
}

export interface CommandHandler<T = any> {
  supports(commandType: string): boolean;
  handle(ctx: CommandHandlerContext<T>): CommandHandlingResult;
}
