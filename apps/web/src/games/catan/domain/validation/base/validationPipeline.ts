import { CatanMatchState } from '../../model/catanMatchState';

export interface CommandValidationContext {
  state: CatanMatchState;
  playerId: string;
}

export interface ValidationResult {
  ok: boolean;
  code?: string;
  message?: string;
}

export interface ValidationStep<T = any> {
  name: string;
  supports(commandType: string): boolean;
  validate(ctx: CommandValidationContext & { command: T }): ValidationResult;
}

export function runValidationPipeline<T>(
  steps: ValidationStep<T>[],
  ctx: CommandValidationContext & { command: T }
): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const step of steps) {
    const result = step.validate(ctx);
    results.push(result);
    if (!result.ok) break;
  }

  return results;
}

export function validationPassed(results: ValidationResult[]): boolean {
  return results.every((r) => r.ok);
}
