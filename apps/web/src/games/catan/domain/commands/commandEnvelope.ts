export interface CatanCommandEnvelope {
  commandId: string;
  sequence: number;
  emittedAt: number;
  playerId: string;
  command: any; // Type strictly later
}
