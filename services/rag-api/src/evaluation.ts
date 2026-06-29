import { RetrievalResult } from "./types.js";

export type EvalCase = {
  query: string;
  expectedChunkIds: string[];
  retrieved: RetrievalResult[];
  answer: string;
  citations: Array<{ chunkId: string }>;
};

export function evaluateCases(cases: EvalCase[], k = 5) {
  const recallAtK = average(cases.map((item) => recall(item.expectedChunkIds, item.retrieved.slice(0, k).map((result) => result.id))));
  const precisionAtK = average(cases.map((item) => precision(item.expectedChunkIds, item.retrieved.slice(0, k).map((result) => result.id))));
  const mrr = average(cases.map((item) => reciprocalRank(item.expectedChunkIds, item.retrieved.map((result) => result.id))));
  const citationAccuracy = average(cases.map((item) => precision(item.expectedChunkIds, item.citations.map((citation) => citation.chunkId))));
  const hallucinationRate = average(cases.map((item) => item.answer === "No indexed documents match the query." && item.retrieved.length > 0 ? 1 : 0));
  return {
    recallAtK,
    precisionAtK,
    mrr,
    groundedness: citationAccuracy,
    faithfulness: citationAccuracy,
    citationAccuracy,
    hallucinationRate
  };
}

function recall(expected: string[], actual: string[]) {
  if (!expected.length) return actual.length ? 0 : 1;
  return expected.filter((id) => actual.includes(id)).length / expected.length;
}

function precision(expected: string[], actual: string[]) {
  if (!actual.length) return expected.length ? 0 : 1;
  return actual.filter((id) => expected.includes(id)).length / actual.length;
}

function reciprocalRank(expected: string[], actual: string[]) {
  const index = actual.findIndex((id) => expected.includes(id));
  return index === -1 ? 0 : 1 / (index + 1);
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
