export type GameErrorCode =
  | "INVALID_TRANSITION"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHENTICATED"
  | "CONFLICT"
  | "VALIDATION";

/** Every rejection the engine produces is one of these — route handlers
 * map the code to an HTTP status and never leak internal details past
 * the message. */
export class GameEngineError extends Error {
  readonly code: GameErrorCode;

  constructor(code: GameErrorCode, message: string) {
    super(message);
    this.name = "GameEngineError";
    this.code = code;
  }
}

export const HTTP_STATUS_BY_CODE: Record<GameErrorCode, number> = {
  INVALID_TRANSITION: 409,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  UNAUTHENTICATED: 401,
  CONFLICT: 409,
  VALIDATION: 400,
};
