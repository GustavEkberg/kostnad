import { Effect, Schema as S } from 'effect';
import { AI } from '@/lib/services/anthropic/live-layer';

type Transaction = {
  id: string;
  merchant: string;
  amount: number;
};

type Category = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
};

export type CategorySuggestion = {
  transactionId: string;
  suggestedCategoryId: string | null;
  confidence: 'high' | 'medium' | 'low';
};

// Schema to parse AI response
const SuggestionResponse = S.Struct({
  suggestions: S.Array(
    S.Struct({
      transactionId: S.String,
      categoryId: S.Union(S.String, S.Null),
      confidence: S.Literal('high', 'medium', 'low')
    })
  )
});

const parseJsonSafely = (str: string): unknown => {
  try {
    // Remove markdown code blocks if present
    const cleaned = str.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { suggestions: [] };
  }
};

/**
 * Use AI to suggest categories for uncategorized transactions.
 * Returns suggestions with confidence levels - user still reviews/confirms.
 * Batches large transaction lists to avoid token limits.
 */
export const suggestCategories = (
  transactions: Transaction[],
  categories: Category[]
): Effect.Effect<CategorySuggestion[], never, AI> =>
  Effect.gen(function* () {
    if (transactions.length === 0 || categories.length === 0) {
      return [];
    }

    const ai = yield* AI;

    const categoryList = categories
      .map(c => {
        const parts = [`"${c.id}": ${c.name}`];
        if (c.description) parts.push(`- ${c.description}`);
        return `- ${parts.join(' ')}`;
      })
      .join('\n');

    // Batch transactions to avoid token limits (max 20 per request)
    const batchSize = 20;
    const batches: Transaction[][] = [];
    for (let i = 0; i < transactions.length; i += batchSize) {
      batches.push(transactions.slice(i, i + batchSize));
    }

    const allSuggestions: CategorySuggestion[] = [];

    for (const batch of batches) {
      const transactionList = batch
        .map(t => `- id="${t.id}", merchant="${t.merchant}", amount=${t.amount}`)
        .join('\n');

      const system = `You are a financial categorization assistant. Suggest categories for bank transactions.

Available categories:
${categoryList}

Respond with ONLY valid JSON, no explanation or markdown. Format:
{"suggestions":[{"transactionId":"...","categoryId":"..." or null,"confidence":"high"|"medium"|"low"}]}

Rules:
- "high": merchant clearly indicates category (e.g., "ICA" → Groceries)
- "medium": somewhat confident based on patterns
- "low": uncertain guess
- null categoryId if no category fits
- Be conservative - prefer null over wrong category`;

      const userMessage = `Categorize:\n${transactionList}`;

      const response = yield* ai
        .complete({
          system,
          messages: [{ role: 'user', content: userMessage }],
          maxTokens: 4096
        })
        .pipe(Effect.catchAll(() => Effect.succeed('{"suggestions":[]}')));

      const parsed = yield* S.decodeUnknown(SuggestionResponse)(parseJsonSafely(response)).pipe(
        Effect.catchAll(() => Effect.succeed({ suggestions: [] }))
      );

      for (const s of parsed.suggestions) {
        allSuggestions.push({
          transactionId: s.transactionId,
          suggestedCategoryId: s.categoryId,
          confidence: s.confidence
        });
      }
    }

    return allSuggestions;
  }).pipe(Effect.withSpan('Transaction.suggestCategories'));
