import { CostBreakdown, ModelPricing, OptimizerCost, OptimizerCostMode, PricingStatus } from '../types';

/**
 * Standard registry for LLM provider pricing (cost per 1M tokens in USD).
 */
export class ModelPricingRegistry {
  private static instance: ModelPricingRegistry;
  private pricingStore: Map<string, ModelPricing> = new Map();
  private aliasMap: Map<string, string> = new Map();

  private constructor() {
    this.initDefaultPricing();
  }

  public static getInstance(): ModelPricingRegistry {
    if (!ModelPricingRegistry.instance) {
      ModelPricingRegistry.instance = new ModelPricingRegistry();
    }
    return ModelPricingRegistry.instance;
  }

  private initDefaultPricing(): void {
    const defaults: ModelPricing[] = [
      {
        provider: 'anthropic',
        model: 'claude-sonnet-4',
        inputCostPerMillion: 3.0,
        outputCostPerMillion: 15.0,
        currency: 'USD',
        effectiveFrom: '2025-05-01',
        pricingKnown: true,
      },
      {
        provider: 'anthropic',
        model: 'claude-3-7-sonnet',
        inputCostPerMillion: 3.0,
        outputCostPerMillion: 15.0,
        currency: 'USD',
        effectiveFrom: '2025-01-01',
        pricingKnown: true,
      },
      {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        inputCostPerMillion: 3.0,
        outputCostPerMillion: 15.0,
        currency: 'USD',
        effectiveFrom: '2024-06-01',
        pricingKnown: true,
      },
      {
        provider: 'anthropic',
        model: 'claude-3-5-haiku',
        inputCostPerMillion: 0.8,
        outputCostPerMillion: 4.0,
        currency: 'USD',
        effectiveFrom: '2024-11-01',
        pricingKnown: true,
      },
      {
        provider: 'openai',
        model: 'gpt-4o',
        inputCostPerMillion: 2.5,
        outputCostPerMillion: 10.0,
        currency: 'USD',
        effectiveFrom: '2024-05-01',
        pricingKnown: true,
      },
      {
        provider: 'openai',
        model: 'gpt-4o-mini',
        inputCostPerMillion: 0.15,
        outputCostPerMillion: 0.6,
        currency: 'USD',
        effectiveFrom: '2024-07-01',
        pricingKnown: true,
      },
      {
        provider: 'google',
        model: 'gemini-2.5-pro',
        inputCostPerMillion: 1.25,
        outputCostPerMillion: 5.0,
        currency: 'USD',
        effectiveFrom: '2025-03-01',
        pricingKnown: true,
      },
      {
        provider: 'google',
        model: 'gemini-1.5-pro',
        inputCostPerMillion: 1.25,
        outputCostPerMillion: 5.0,
        currency: 'USD',
        effectiveFrom: '2024-05-01',
        pricingKnown: true,
      },
      {
        provider: 'google',
        model: 'gemini-1.5-flash',
        inputCostPerMillion: 0.075,
        outputCostPerMillion: 0.3,
        currency: 'USD',
        effectiveFrom: '2024-05-01',
        pricingKnown: true,
      },
      {
        provider: 'google',
        model: 'gemini-2.0-flash',
        inputCostPerMillion: 0.1,
        outputCostPerMillion: 0.4,
        currency: 'USD',
        effectiveFrom: '2025-02-01',
        pricingKnown: true,
      },
      {
        provider: 'google',
        model: 'gemini-3.6-flash',
        inputCostPerMillion: 0.1,
        outputCostPerMillion: 0.4,
        currency: 'USD',
        effectiveFrom: '2026-01-01',
        pricingKnown: true,
      },
      {
        provider: 'deepseek',
        model: 'deepseek-r1',
        inputCostPerMillion: 0.55,
        outputCostPerMillion: 2.19,
        currency: 'USD',
        effectiveFrom: '2025-01-20',
        pricingKnown: true,
      },
    ];

    for (const p of defaults) {
      this.registerPricing(p);
    }

    // Set up model aliases
    this.aliasMap.set('claude-3.5-sonnet', 'claude-3-5-sonnet');
    this.aliasMap.set('claude-3.7-sonnet', 'claude-3-7-sonnet');
    this.aliasMap.set('claude-3.5-haiku', 'claude-3-5-haiku');
    this.aliasMap.set('claude-haiku-3.5', 'claude-3-5-haiku');
    this.aliasMap.set('gpt4o', 'gpt-4o');
    this.aliasMap.set('gpt4o-mini', 'gpt-4o-mini');
  }

  public normalizeModelName(model: string): string {
    const clean = model.trim().toLowerCase();
    return this.aliasMap.get(clean) || clean;
  }

  public registerPricing(pricing: ModelPricing): void {
    const normModel = this.normalizeModelName(pricing.model);
    const key = `${pricing.provider.toLowerCase()}:${normModel}`;
    this.pricingStore.set(key, { ...pricing, model: normModel });
    this.pricingStore.set(normModel, { ...pricing, model: normModel });
  }

  public getPricing(provider: string | undefined, model: string): ModelPricing | null {
    const normModel = this.normalizeModelName(model);
    if (provider) {
      const key = `${provider.toLowerCase()}:${normModel}`;
      if (this.pricingStore.has(key)) {
        return this.pricingStore.get(key)!;
      }
    }
    if (this.pricingStore.has(normModel)) {
      return this.pricingStore.get(normModel)!;
    }
    return null;
  }

  /**
   * Resolves pricing for a model or safely falls back to a default baseline model for telemetry/reporting.
   */
  public getPricingWithFallback(
    provider: string | undefined,
    model: string | undefined,
    fallbackModel = 'claude-sonnet-4'
  ): { pricing: ModelPricing; isFallback: boolean } {
    if (model) {
      const direct = this.getPricing(provider, model);
      if (direct && direct.pricingKnown) {
        return { pricing: direct, isFallback: false };
      }
    }
    const fallback = this.getPricing(undefined, fallbackModel)!;
    return { pricing: fallback, isFallback: true };
  }

  /**
   * Formats a human-readable model pricing label (e.g. "GPT-4o ($2.50/1M)").
   */
  public formatDisplayLabel(pricing: ModelPricing, isFallback = false): string {
    const nameMap: Record<string, string> = {
      'claude-sonnet-4': 'Claude Sonnet 4',
      'claude-3-7-sonnet': 'Claude 3.7 Sonnet',
      'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
      'claude-3-5-haiku': 'Claude 3.5 Haiku',
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini',
      'gemini-2.5-pro': 'Gemini 2.5 Pro',
      'gemini-1.5-pro': 'Gemini 1.5 Pro',
      'gemini-1.5-flash': 'Gemini 1.5 Flash',
      'gemini-2.0-flash': 'Gemini 2.0 Flash',
      'gemini-3.6-flash': 'Gemini 3.6 Flash',
      'deepseek-r1': 'DeepSeek R1',
    };
    const label = nameMap[pricing.model] || pricing.model;
    const suffix = isFallback ? ' [fallback]' : '';
    return `${label} ($${pricing.inputCostPerMillion.toFixed(2)}/1M)${suffix}`;
  }

  public getPricingStatus(provider: string | undefined, model: string): PricingStatus {
    const pricing = this.getPricing(provider, model);
    if (!pricing || !pricing.pricingKnown) {
      return 'PRICE_UNAVAILABLE';
    }
    return 'KNOWN';
  }
}

export interface CalculateModelCostOptions {
  provider?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  retryCost?: number;
}

/**
 * Calculates exact financial cost for model input/output tokens.
 * Returns PRICE_UNAVAILABLE with 0 cost if pricing is unknown.
 */
export function calculateModelCost(options: CalculateModelCostOptions): CostBreakdown {
  const registry = ModelPricingRegistry.getInstance();
  const pricing = registry.getPricing(options.provider, options.model);

  if (!pricing || !pricing.pricingKnown) {
    return {
      inputTokens: options.inputTokens,
      outputTokens: options.outputTokens,
      inputCost: 0,
      outputCost: 0,
      retryCost: options.retryCost || 0,
      totalCost: 0,
      pricingStatus: 'PRICE_UNAVAILABLE',
    };
  }

  const inputCost = (options.inputTokens / 1_000_000) * pricing.inputCostPerMillion;
  const outputCost = (options.outputTokens / 1_000_000) * pricing.outputCostPerMillion;
  const retryCost = options.retryCost || 0;
  const totalCost = inputCost + outputCost + retryCost;

  return {
    inputTokens: options.inputTokens,
    outputTokens: options.outputTokens,
    inputCost: parseFloat(inputCost.toFixed(6)),
    outputCost: parseFloat(outputCost.toFixed(6)),
    retryCost: parseFloat(retryCost.toFixed(6)),
    totalCost: parseFloat(totalCost.toFixed(6)),
    pricingStatus: 'KNOWN',
  };
}

export interface CalculateOptimizerCostOptions {
  latencyMs: number;
  mode?: OptimizerCostMode;
  configuredRateMs?: number;
}

/**
 * Calculates optimizer compute overhead cost based on latency in ms.
 */
export function calculateOptimizerCost(options: CalculateOptimizerCostOptions): OptimizerCost {
  const mode = options.mode || 'estimated';
  // Default rate: $0.000001 per ms ($0.001 / sec)
  const ratePerMs = options.configuredRateMs ?? 0.000001;
  const cost = parseFloat((options.latencyMs * ratePerMs).toFixed(6));

  const confidence = mode === 'workspace_configured' ? 'configured' : mode === 'measured' ? 'measured' : 'estimated';

  return {
    latencyMs: options.latencyMs,
    cost,
    mode,
    confidence,
  };
}
