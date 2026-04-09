import { PlayerId, VertexId } from '../../domain/model/catanMatchState';
import { CatanDomainEventEnvelope } from '../../domain/model/catanMatchState';
import { CommandHandlerContext, CommandHandlingResult, CommandHandler } from '../commandBus/commandHandler';
import { runValidationPipeline, validationPassed } from '../../domain/validation/base/validationPipeline';
import { getLegalInitialSettlementVertices } from '../../domain/rules/placementRules';

interface PlaceInitialSettlementCommand {
  vertexId: VertexId;
}

export class HandlePlaceInitialSettlement implements CommandHandler<PlaceInitialSettlementCommand> {
  supports(commandType: string): boolean {
    return commandType === "PLACE_INITIAL_SETTLEMENT";
  }

  handle(ctx: CommandHandlerContext<PlaceInitialSettlementCommand>): CommandHandlingResult {
    const { state, envelope, now } = ctx;
    const command = envelope.command as PlaceInitialSettlementCommand;

    const results = runValidationPipeline(
      [
        {
          name: "validateActivePlayer",
          supports: () => true,
          validate: ({ state, playerId }) => ({
            ok: state.turn.activePlayerId === playerId,
            code: "NOT_ACTIVE_PLAYER",
            message: "It is not your turn."
          })
        },
        {
          name: "validateSetupPhase",
          supports: () => true,
          validate: ({ state }) => ({
            ok: state.lifecycle.phase.includes("SETUP") && state.lifecycle.phase.includes("SETTLEMENT"),
            code: "WRONG_PHASE",
            message: "Cannot place initial settlement now."
          })
        },
        {
          name: "validateLegalPlacement",
          supports: () => true,
          validate: ({ state, playerId, command }) => {
            const legalVertices = getLegalInitialSettlementVertices(state, playerId as PlayerId);
            return {
              ok: legalVertices.includes(command.vertexId),
              code: "ILLEGAL_PLACEMENT",
              message: "Cannot place settlement there."
            };
          }
        }
      ],
      {
        state,
        playerId: envelope.playerId,
        command
      }
    );

    if (!validationPassed(results)) {
      const failed = results.find((r) => !r.ok)!;
      return {
        accepted: false,
        events: [],
        rejection: {
          code: failed.code!,
          message: failed.message!
        }
      };
    }

    const event: CatanDomainEventEnvelope = {
      eventId: crypto.randomUUID() as any, // Using random UUID as mock EventId
      sequence: state.log.sequence + 1,
      emittedAt: now,
      causedByCommandId: envelope.commandId as any,
      causedByPlayerId: envelope.playerId as PlayerId,
      event: {
        type: "INITIAL_SETTLEMENT_PLACED",
        playerId: envelope.playerId,
        vertexId: command.vertexId,
      }
    };

    return {
      accepted: true,
      events: [event],
    };
  }
}
