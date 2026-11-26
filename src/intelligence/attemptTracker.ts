import { ExecutionAttempt } from '../types';

/**
 * Tracks execution attempts and calculates actual retry/failure costs for requests.
 */
export class AttemptTracker {
  private static instance: AttemptTracker;
  private attemptsMap: Map<string, ExecutionAttempt[]> = new Map();

  private constructor() {}

  public static getInstance(): AttemptTracker {
    if (!AttemptTracker.instance) {
      AttemptTracker.instance = new AttemptTracker();
    }
    return AttemptTracker.instance;
  }

  /**
   * Records a new execution attempt for a request ID.
   */
  public recordAttempt(attempt: Omit<ExecutionAttempt, 'timestamp' | 'totalCost'>): ExecutionAttempt {
    const totalCost = parseFloat((attempt.inputCost + attempt.outputCost).toFixed(6));
    const fullAttempt: ExecutionAttempt = {
      ...attempt,
      totalCost,
      timestamp: Date.now(),
    };

    const existing = this.attemptsMap.get(attempt.requestId) || [];
    existing.push(fullAttempt);
    this.attemptsMap.set(attempt.requestId, existing);

    return fullAttempt;
  }

  /**
   * Gets all recorded attempts for a request ID.
   */
  public getAttempts(requestId: string): ExecutionAttempt[] {
    return this.attemptsMap.get(requestId) || [];
  }

  /**
   * Calculates total financial cost of all failed prior attempts (retries) for a request.
   */
  public calculateRetryCost(requestId: string): number {
    const attempts = this.getAttempts(requestId);
    if (attempts.length <= 1) return 0;

    let retryCost = 0;
    // Accumulate cost of all attempts before the final successful attempt or all failed attempts
    for (let i = 0; i < attempts.length - 1; i++) {
      retryCost += attempts[i].totalCost;
    }
    return parseFloat(retryCost.toFixed(6));
  }

  /**
   * Clears attempt records for testing or tenant cleanup.
   */
  public clear(): void {
    this.attemptsMap.clear();
  }
}
