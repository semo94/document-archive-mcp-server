/**
 * Intent types for document queries
 * These categorize different kinds of information-seeking behaviors
 */

// Intent type definitions
// retrievalConfig.ts
export type RetrievalConfig = {
  // How to perform the search; 'exact' for full scan vs. 'approximate' for ANN indexes.
  indexType: "exact" | "approximate";
  // Number of nearest neighbors to retrieve.
  k: number;
  // Which similarity metric to use
  distanceMetric: "cosine" | "euclidean" | "dot";
  // Optional: a factor to refine initial ANN results if using a two-stage process
  refineFactor: number;
};

// Define your intent types.
export const intentTypes = [
  "factual_retrieval",
  "conceptual_explanation",
  "comparative_analysis",
  "historical_context",
  "statistical_data",
  "methodological_inquiry",
  "application_examples"
];

// Map intents to retrieval configurations.
// You can adjust these parameters based on your empirical tests.
export const retrievalConfigs: Record<string, RetrievalConfig> = {
  factual_retrieval: { indexType: "exact", k: 10, distanceMetric: "cosine", refineFactor: 1 },
  conceptual_explanation: { indexType: "exact", k: 8, distanceMetric: "cosine", refineFactor: 1 },
  comparative_analysis: { indexType: "approximate", k: 15, distanceMetric: "dot", refineFactor: 3 },
  historical_context: { indexType: "approximate", k: 12, distanceMetric: "cosine", refineFactor: 2 },
  statistical_data: { indexType: "exact", k: 8, distanceMetric: "euclidean", refineFactor: 1 },
  methodological_inquiry: { indexType: "approximate", k: 12, distanceMetric: "cosine", refineFactor: 2 },
  application_examples: { indexType: "exact", k: 10, distanceMetric: "cosine", refineFactor: 1 },
};

export function getRetrievalConfig(intent: string): RetrievalConfig {
  // Default to factual_retrieval configuration if no match is found.
  return retrievalConfigs[intent] || retrievalConfigs["factual_retrieval"];
}
