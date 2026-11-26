import { calculateModelCost } from '../intelligence/economicsEngine';
import { Tokenizer } from '../core/tokenizer';

export interface RealLLMRequest {
  prompt: string;
  context: string;
  filePath?: string;
  model?: string;
  provider?: 'anthropic' | 'openai' | 'auto';
  maxTokens?: number;
}

export interface RealLLMResponse {
  requestId: string;
  provider: string;
  model: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  costUsd: number;
  isMockMode: boolean;
  mockReason?: string;
  statusCode?: number;
  error?: string;
}

export class RealLLMClient {
  private apiKey: string | undefined;
  private provider: 'anthropic' | 'openai';
  private model: string;

  constructor() {
    const rawProvider = process.env.SHANAXON_PROVIDER || 'openai';
    this.provider = rawProvider.toLowerCase() === 'anthropic' ? 'anthropic' : 'openai';

    this.apiKey =
      process.env.SHANAXON_API_KEY ||
      (this.provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY);

    this.model =
      process.env.SHANAXON_MODEL ||
      (this.provider === 'anthropic' ? 'claude-3-5-haiku' : 'gpt-4o-mini');
  }

  public isMockMode(): boolean {
    return !this.apiKey || this.apiKey.trim() === '' || process.env.SHANAXON_MOCK_MODE === 'true';
  }

  public async call(req: RealLLMRequest): Promise<RealLLMResponse> {
    const provider = req.provider && req.provider !== 'auto' ? req.provider : this.provider;
    const model = req.model || this.model;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (this.isMockMode()) {
      return this.executeMockCall(requestId, provider, model, req);
    }

    const startMs = Date.now();
    try {
      if (provider === 'anthropic') {
        return await this.callAnthropic(requestId, model, req, startMs);
      } else {
        return await this.callOpenAI(requestId, model, req, startMs);
      }
    } catch (err: any) {
      console.warn(`[RealLLMClient] Real API call failed (${err?.message}). Falling back to Mock Mode for request ${requestId}.`);
      return this.executeMockCall(requestId, provider, model, req, `API Call Exception: ${err?.message}`);
    }
  }

  private async callOpenAI(
    requestId: string,
    model: string,
    req: RealLLMRequest,
    startMs: number
  ): Promise<RealLLMResponse> {
    const url = 'https://api.openai.com/v1/chat/completions';
    const payload = {
      model,
      messages: [
        { role: 'system', content: 'You are an expert software engineering assistant.' },
        { role: 'user', content: `Context:\n${req.context}\n\nTask:\n${req.prompt}` },
      ],
      max_tokens: req.maxTokens || 300,
      temperature: 0.2,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const latencyMs = Math.max(1, Date.now() - startMs);

    if (!res.ok) {
      const errText = await res.text();
      return this.executeMockCall(requestId, 'openai', model, req, `HTTP ${res.status}: ${errText.substring(0, 100)}`);
    }

    const data: any = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const estimatedInput = Tokenizer.countTokens(req.context, req.filePath) + Tokenizer.countTokens(req.prompt);
    const inputTokens = data.usage?.prompt_tokens || estimatedInput;
    const outputTokens = data.usage?.completion_tokens || Tokenizer.countTokens(content);

    const costObj = calculateModelCost({
      provider: 'openai',
      model,
      inputTokens,
      outputTokens,
    });

    return {
      requestId,
      provider: 'openai',
      model,
      content,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      latencyMs,
      costUsd: costObj.totalCost,
      isMockMode: false,
      statusCode: res.status,
    };
  }

  private async callAnthropic(
    requestId: string,
    model: string,
    req: RealLLMRequest,
    startMs: number
  ): Promise<RealLLMResponse> {
    const url = 'https://api.anthropic.com/v1/messages';
    const payload = {
      model,
      max_tokens: req.maxTokens || 300,
      system: 'You are an expert software engineering assistant.',
      messages: [
        { role: 'user', content: `Context:\n${req.context}\n\nTask:\n${req.prompt}` },
      ],
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    const latencyMs = Math.max(1, Date.now() - startMs);

    if (!res.ok) {
      const errText = await res.text();
      return this.executeMockCall(requestId, 'anthropic', model, req, `HTTP ${res.status}: ${errText.substring(0, 100)}`);
    }

    const data: any = await res.json();
    const content = data.content?.[0]?.text || '';
    const estimatedInput = Tokenizer.countTokens(req.context, req.filePath) + Tokenizer.countTokens(req.prompt);
    const inputTokens = data.usage?.input_tokens || estimatedInput;
    const outputTokens = data.usage?.output_tokens || Tokenizer.countTokens(content);

    const costObj = calculateModelCost({
      provider: 'anthropic',
      model,
      inputTokens,
      outputTokens,
    });

    return {
      requestId,
      provider: 'anthropic',
      model,
      content,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      latencyMs,
      costUsd: costObj.totalCost,
      isMockMode: false,
      statusCode: res.status,
    };
  }

  private executeMockCall(
    requestId: string,
    provider: string,
    model: string,
    req: RealLLMRequest,
    mockReason: string = 'No API Key provided (Standard Mock Mode)'
  ): RealLLMResponse {
    const contextTokens = Tokenizer.countTokens(req.context, req.filePath);
    const promptTokens = Tokenizer.countTokens(req.prompt);
    const inputTokens = Math.max(10, contextTokens + promptTokens);
    const outputTokens = Math.max(30, Math.min(req.maxTokens || 300, Math.ceil(inputTokens * 0.08)));

    const mockResponseText = `[MOCK RESPONSE] Analysis complete for task query. Ground truth symbols verified in provided context of length ${req.context.length} chars. Key interfaces, functions, and exports identified successfully.`;

    const costObj = calculateModelCost({
      provider,
      model,
      inputTokens,
      outputTokens,
    });

    return {
      requestId,
      provider,
      model,
      content: mockResponseText,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      latencyMs: Math.floor(15 + Math.random() * 25),
      costUsd: costObj.totalCost,
      isMockMode: true,
      mockReason,
      statusCode: 200,
    };
  }
}
