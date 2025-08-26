import * as businessService from "./businessService";

import { Transaction } from "../types";

const BACKEND_URL =
  process.env.BACKEND_URL || "http://localhost:3000/api/transactions";
type CreateTxResponse = { success: boolean; data: Transaction };

export const generateMockTransactions = async (
  numTransactions: number
): Promise<Transaction[]> => {
  const businesses = await businessService.getAllBusinesses();

  if (businesses.length < 2) {
    throw new Error(
      "At least two businesses are required to create transactions"
    );
  }

  const requests: Promise<Transaction>[] = Array.from(
    { length: numTransactions },
    async () => {
      const firstBusiness =
        businesses[Math.floor(Math.random() * businesses.length)];

      let secondBusiness;
      do {
        secondBusiness =
          businesses[Math.floor(Math.random() * businesses.length)];
      } while (firstBusiness.business_id === secondBusiness.business_id);

      const payload = {
        from: firstBusiness.business_id,
        to: secondBusiness.business_id,
        amount: Math.floor(Math.random() * (10000 - 100 + 1)) + 100, // 100–10000
        timestamp: new Date().toISOString(),
      };

      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const data = (await res.json()) as CreateTxResponse;
      return data.data;
    }
  );

  return Promise.all(requests);
};
