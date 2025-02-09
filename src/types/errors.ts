export interface APIErrorDetails {
  message: string;
  type: string;
  code: string;
  status?: number;
}

export class AIServiceError extends Error {
  constructor(
    message: string,
    public provider: string,
    public details: APIErrorDetails
  ) {
    super(message);
    this.name = "AIServiceError";
  }

  public static fromOpenAIError(error: any, provider: string): AIServiceError {
    const status = error.status || error.statusCode;
    const details: APIErrorDetails = {
      message: error.error?.message || error.message,
      type: error.error?.type || "unknown",
      code: error.error?.code || "unknown",
      status,
    };

    let message = `${provider} API Error: ${details.message}`;
    if (status === 402) {
      message = `${provider} API Error: Insufficient balance. Please check your account credits.`;
    }

    return new AIServiceError(message, provider, details);
  }
}
