import Anthropic from '@anthropic-ai/sdk';
import { Config, Context, Effect, Layer, Redacted } from 'effect';
import { AnthropicConfigError, AnthropicApiError } from './errors';

export { AnthropicConfigError, AnthropicApiError };

// Configuration service (internal)
class AnthropicConfig extends Context.Tag('@app/AnthropicConfig')<
  AnthropicConfig,
  {
    readonly apiKey: Redacted.Redacted<string>;
  }
>() {}

const AnthropicConfigLive = Layer.effect(
  AnthropicConfig,
  Effect.gen(function* () {
    const apiKey = yield* Config.redacted('ANTHROPIC_API_KEY').pipe(
      Effect.mapError(() => new AnthropicConfigError({ message: 'ANTHROPIC_API_KEY not found' }))
    );
    return { apiKey };
  })
);

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

// Service definition
export class AI extends Effect.Service<AI>()('@app/AI', {
  effect: Effect.gen(function* () {
    const config = yield* AnthropicConfig;
    const client = new Anthropic({ apiKey: Redacted.value(config.apiKey) });

    /**
     * Generate text completion using Claude.
     */
    const complete = (params: {
      system?: string;
      messages: Message[];
      maxTokens?: number;
    }): Effect.Effect<string, AnthropicApiError> =>
      Effect.gen(function* () {
        yield* Effect.annotateCurrentSpan({
          'ai.model': 'claude-haiku-4-5-20251001',
          'ai.messages.count': params.messages.length
        });

        const response = yield* Effect.tryPromise({
          try: () =>
            client.messages.create({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: params.maxTokens ?? 1024,
              system: params.system,
              messages: params.messages
            }),
          catch: error =>
            new AnthropicApiError({
              message: error instanceof Error ? error.message : 'Unknown Anthropic API error',
              cause: error
            })
        });

        const textBlock = response.content.find(block => block.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
          return yield* new AnthropicApiError({ message: 'No text content in response' });
        }

        yield* Effect.annotateCurrentSpan({
          'ai.usage.input_tokens': response.usage.input_tokens,
          'ai.usage.output_tokens': response.usage.output_tokens
        });

        return textBlock.text;
      }).pipe(
        Effect.withSpan('AI.complete'),
        Effect.tapError(error =>
          Effect.logError('AI completion failed', {
            error
          })
        )
      );

    return { complete } as const;
  })
}) {
  // Base layer (has unsatisfied AnthropicConfig dependency)
  static layer = this.Default;

  // Composed layer with all dependencies satisfied
  static Live = this.layer.pipe(Layer.provide(AnthropicConfigLive));
}
