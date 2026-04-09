import { CatanMatchState } from '../../domain/model/catanMatchState';
import { CatanCommandEnvelope } from '../../domain/commands/commandEnvelope';
import { CommandHandlingResult } from '../../application/commandBus/commandHandler';

export interface ScenarioContext {
  state: CatanMatchState;
  dispatch: (commandEnvelope: CatanCommandEnvelope) => CommandHandlingResult;
  lastResult?: CommandHandlingResult;
}

export interface ScenarioStep {
  action: (ctx: ScenarioContext) => void;
  assert?: (ctx: ScenarioContext) => void;
}

export function runScenario(
  initialState: CatanMatchState,
  dispatchCommand: (state: CatanMatchState, envelope: CatanCommandEnvelope) => { nextState: CatanMatchState, result: CommandHandlingResult },
  steps: ScenarioStep[]
): ScenarioContext {
  const ctx: ScenarioContext = {
    state: initialState,
    dispatch: (envelope: CatanCommandEnvelope) => {
      const { nextState, result } = dispatchCommand(ctx.state, envelope);
      ctx.state = nextState;
      ctx.lastResult = result;
      return result;
    }
  };

  for (const step of steps) {
    step.action(ctx);
    if (step.assert) {
      step.assert(ctx);
    }
  }

  return ctx;
}
