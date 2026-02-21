import { Data } from 'effect';

export class AnthropicConfigError extends Data.TaggedError('AnthropicConfigError')<{
  message: string;
}> {}

export class AnthropicApiError extends Data.TaggedError('AnthropicApiError')<{
  message: string;
  cause?: unknown;
}> {}
