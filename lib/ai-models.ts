/**
 * Ready-to-use model IDs for `.env.local` (`CEREBRAS_MODEL`, `MISTRAL_MODEL`).
 * Exact IDs can change — check each provider’s docs if a call fails.
 */

/** Cerebras Inference — https://inference-docs.cerebras.ai/models */
export const CerebrasModels = {
  llama31_8b: 'llama3.1-8b',
  llama31_70b: 'llama3.1-70b',
} as const;

/** Mistral AI — https://docs.mistral.ai/getting-started/models/ */
export const MistralModels = {
  mistral7b: 'open-mistral-7b',
  mixtral: 'open-mixtral-8x7b',
  mistralSmall: 'mistral-small-latest',
} as const;

/** Defaults when `*_MODEL` env vars are omitted */
export const defaultChatModels = {
  cerebras: CerebrasModels.llama31_8b,
  mistral: MistralModels.mixtral,
} as const;
