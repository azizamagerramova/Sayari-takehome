import * as businessRepo from "../repositories/businessRepository";
import * as businessService from "./businessService";
import * as graphRepo from "../repositories/graphRepository";

import {
  Transaction,
  EnrichedTransaction,
  CreateTransactionDto,
} from "../types";

/**
 * Get all transactions with optional filtering
 */
export const getAllTransactions = async (
  from?: string,
  to?: string
): Promise<Transaction[]> => {
  return await graphRepo.findAllEdges(from, to);
};

/**
 * Get enriched transactions with business names instead of IDs
 */
export const getEnrichedTransactions = async (
  from?: string,
  to?: string
): Promise<EnrichedTransaction[]> => {
  // Step 1: Fetch transactions from Memgraph
  const transactions = await graphRepo.findAllEdges(from, to);

  // Step 2: Extract unique business IDs
  const ids = new Set<string>();
  transactions.forEach((t) => {
    ids.add(t.from);
    ids.add(t.to);
  });
  const uniqueBusinessIds = Array.from(ids);

  // Step 3: Get business details from SQLite
  const { nameMap } = await businessRepo.getBusinessDetails(uniqueBusinessIds);

  // Step 4: Enrich transactions with business names
  return transactions.map((t) => ({
    from: nameMap[t.from] || t.from,
    to: nameMap[t.to] || t.to,
    amount: t.amount,
    timestamp: t.timestamp,
  }));
};

/**
 * Get filtered transactions by various criteria
 */
export const getFilteredTransactions = async (
  from?: string,
  to?: string,
  startDate?: string,
  endDate?: string,
  minAmount?: string,
  maxAmount?: string
): Promise<Transaction[]> => {
  return await graphRepo.findFilteredEdges(
    from,
    to,
    startDate,
    endDate,
    minAmount,
    maxAmount
  );
};

/**
 * Create a new transaction between two businesses
 */
export const createTransaction = async (
  dto: CreateTransactionDto
): Promise<Transaction> => {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // open session/tx, run Cypher, commit, return
      return await graphRepo.createEdge(
        dto.from,
        dto.to,
        dto.amount,
        dto.timestamp
      );
    } catch (err: any) {
      const msg = String(err?.message || "");
      const retryable =
        msg.includes("conflicting transactions") ||
        msg.includes("Retry this transaction");
      if (!retryable || attempt === MAX_RETRIES) throw err;

      const backoff = Math.min(100 * 2 ** attempt + Math.random() * 50, 1000);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw new Error("unreachable");
};

/**
 * Enrich transaction data with business names for notifications
 */
export const enrichTransaction = async (
  dto: CreateTransactionDto
): Promise<Transaction> => {
  const businesses = await businessService.getBusinessesByIds([
    dto.from,
    dto.to,
  ]);
  const businessMap = new Map(businesses.map((b) => [b.business_id, b]));

  return {
    from: businessMap.get(dto.from)?.name || dto.from,
    to: businessMap.get(dto.to)?.name || dto.to,
    amount: dto.amount,
    timestamp: dto.timestamp,
  };
};
