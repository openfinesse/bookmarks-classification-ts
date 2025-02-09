export type HTTPStatus = 200 | 400 | 401 | 402 | 403 | 429 | 500;

export interface APIErrorDetails {
  message: string;
  type: string;
  code: string;
  status?: HTTPStatus;
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
    const status = (error.status || error.statusCode) as HTTPStatus;
    const details: APIErrorDetails = {
      message: error.error?.message || error.message,
      type: error.error?.type || "unknown",
      code: error.error?.code || "unknown",
      status,
    };

    let message = `${provider} API Error: ${details.message}`;

    // Handle specific error cases
    switch (status) {
      case 402:
        message = `${provider} API Error: Insufficient balance. Please check your account credits.`;
        break;
      case 429:
        if (details.code === "insufficient_quota") {
          message = `${provider} API Error: You have exceeded your quota. Please check your subscription plan.`;
        } else {
          message = `${provider} API Error: Too many requests. Please try again later.`;
        }
        break;
      case 401:
        message = `${provider} API Error: Invalid API key. Please check your credentials.`;
        break;
      case 403:
        message = `${provider} API Error: Access denied. Please verify your API key permissions.`;
        break;
    }

    return new AIServiceError(message, provider, details);
  }

  public get isQuotaError(): boolean {
    return (
      this.details.status === 429 ||
      this.details.code === "insufficient_quota" ||
      this.details.status === 402
    );
  }

  public get shouldRetry(): boolean {
    if (this.details.status !== 429) return false;
    return this.details.code !== "insufficient_quota";
  }
}
