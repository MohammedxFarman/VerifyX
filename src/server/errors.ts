export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "analysis_failed",
  ) {
    super(message);
  }
}
export function abortCheck(signal?: AbortSignal) {
  if (signal?.aborted)
    throw new AppError(
      408,
      "Analysis was canceled or exceeded its time limit.",
      "timeout",
    );
}
