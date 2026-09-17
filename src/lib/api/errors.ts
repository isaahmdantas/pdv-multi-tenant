export class ApiError extends Error {
  public readonly code: string;

  constructor(status: number, message: string, code = "API_ERROR") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  declare status: number;

  toJSON() {
    return { code: this.code, message: this.message };
  }
}

export const badRequest = (message = "Requisição inválida", code = "BAD_REQUEST") =>
  new ApiError(400, message, code);

export const unauthorized = (message = "Não autenticado", code = "UNAUTHENTICATED") =>
  new ApiError(401, message, code);

export const forbidden = (message = "Acesso negado", code = "FORBIDDEN") =>
  new ApiError(403, message, code);

export const notFound = (message = "Recurso não encontrado", code = "NOT_FOUND") =>
  new ApiError(404, message, code);

export const conflict = (message = "Conflito", code = "CONFLICT") =>
  new ApiError(409, message, code);