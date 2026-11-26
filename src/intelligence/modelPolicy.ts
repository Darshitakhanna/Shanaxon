import { CompressionTier, ModelPolicy } from '../types';

const MODEL_PROFILES: Record<string, ModelPolicy> = {
  'claude-3-7-sonnet': {
    modelName: 'claude-3-7-sonnet',
    maxContextTokens: 200000,
    maxOutputTokens: 8192,
    optimalTier: 'medium',
    maxAllowedTier: 'medium',
    contextWindowSafetyFactor: 0.85,
    reasoningPreservation: true
  },
  'claude-3-5-sonnet': {
    modelName: 'claude-3-5-sonnet',
    maxContextTokens: 200000,
    maxOutputTokens: 8192,
    optimalTier: 'medium',
    maxAllowedTier: 'medium',
    contextWindowSafetyFactor: 0.85,
    reasoningPreservation: true
  },
  'claude-sonnet-4': {
    modelName: 'claude-sonnet-4',
    maxContextTokens: 200000,
    maxOutputTokens: 8192,
    optimalTier: 'medium',
    maxAllowedTier: 'medium',
    contextWindowSafetyFactor: 0.85,
    reasoningPreservation: true
  },
  'claude-3-5-haiku': {
    modelName: 'claude-3-5-haiku',
    maxContextTokens: 200000,
    maxOutputTokens: 8192,
    optimalTier: 'aggressive',
    maxAllowedTier: 'aggressive',
    contextWindowSafetyFactor: 0.80,
    reasoningPreservation: false
  },
  'gpt-4o': {
    modelName: 'gpt-4o',
    maxContextTokens: 128000,
    maxOutputTokens: 16384,
    optimalTier: 'medium',
    maxAllowedTier: 'medium',
    contextWindowSafetyFactor: 0.85,
    reasoningPreservation: true
  },
  'gpt-4o-mini': {
    modelName: 'gpt-4o-mini',
    maxContextTokens: 128000,
    maxOutputTokens: 16384,
    optimalTier: 'aggressive',
    maxAllowedTier: 'aggressive',
    contextWindowSafetyFactor: 0.80,
    reasoningPreservation: false
  },
  'gemini-1.5-pro': {
    modelName: 'gemini-1.5-pro',
    maxContextTokens: 1000000,
    maxOutputTokens: 8192,
    optimalTier: 'normal',
    maxAllowedTier: 'medium',
    contextWindowSafetyFactor: 0.90,
    reasoningPreservation: true
  },
  'gemini-2.0-flash': {
    modelName: 'gemini-2.0-flash',
    maxContextTokens: 1000000,
    maxOutputTokens: 8192,
    optimalTier: 'normal',
    maxAllowedTier: 'medium',
    contextWindowSafetyFactor: 0.90,
    reasoningPreservation: true
  },
  'gemini-3.6-flash': {
    modelName: 'gemini-3.6-flash',
    maxContextTokens: 1000000,
    maxOutputTokens: 8192,
    optimalTier: 'normal',
    maxAllowedTier: 'medium',
    contextWindowSafetyFactor: 0.90,
    reasoningPreservation: true
  },
  'deepseek-r1': {
    modelName: 'deepseek-r1',
    maxContextTokens: 64000,
    maxOutputTokens: 8192,
    optimalTier: 'medium',
    maxAllowedTier: 'aggressive',
    contextWindowSafetyFactor: 0.80,
    reasoningPreservation: true
  }
};

const DEFAULT_POLICY: ModelPolicy = {
  modelName: 'default-frontier',
  maxContextTokens: 128000,
  maxOutputTokens: 4096,
  optimalTier: 'medium',
  maxAllowedTier: 'aggressive',
  contextWindowSafetyFactor: 0.85,
  reasoningPreservation: true
};

const TIER_SEVERITY: Record<CompressionTier, number> = {
  'normal': 0,
  'medium': 1,
  'aggressive': 2,
  'omitted': 3
};

/**
 * Returns the ModelPolicy profile for a model identifier.
 */
export function getModelPolicy(modelName?: string): ModelPolicy {
  if (!modelName) return DEFAULT_POLICY;
  const normalized = modelName.trim().toLowerCase();
  
  for (const [key, profile] of Object.entries(MODEL_PROFILES)) {
    if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)) {
      return profile;
    }
  }
  return DEFAULT_POLICY;
}

/**
 * Ensures that the requested compression tier does not exceed the model policy's max allowed tier for high-reasoning models.
 */
export function adjustTierForModel(requestedTier: CompressionTier, modelName?: string): CompressionTier {
  const policy = getModelPolicy(modelName);
  
  if (requestedTier === 'omitted') return 'omitted';

  const reqSev = TIER_SEVERITY[requestedTier];
  const maxSev = TIER_SEVERITY[policy.maxAllowedTier];

  if (reqSev > maxSev) {
    return policy.maxAllowedTier;
  }
  return requestedTier;
}
