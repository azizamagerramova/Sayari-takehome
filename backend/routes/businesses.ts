import express, { Request, Response } from "express";
import * as businessService from "../services/businessService";
import * as transactionService from "../services/transactionService";

const router = express.Router();

/**
 * GET /api/businesses
 * Fetch all businesses
 */
router.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const businesses = await businessService.getAllBusinesses();
    res.json({ success: true, data: businesses });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        error: (error as Error).message || "An unexpected error occurred",
      });
  }
});

/**
 * GET /api/businesses/transactions
 * Fetch transactions with optional filters and business names
 */
router.get(
  "/transactions",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { from, to } = req.query;
      const enrichedTransactions =
        await transactionService.getEnrichedTransactions(
          from as string | undefined,
          to as string | undefined
        );
      res.json({ success: true, data: enrichedTransactions });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
);

/**
 * GET /api/businesses/:business_id/transaction-count
 * Count transactions for a specific business
 */
router.get(
  "/:business_id/transaction-count",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { business_id } = req.params;
      if (!business_id) {
        res
          .status(400)
          .json({ success: false, error: "Business ID is required" });
        return;
      }

      const result = await businessService.getBusinessTransactionCount(
        business_id
      );
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
);

/**
 * POST /api/businesses
 * Create a new business
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, industry } = req.body;

    // Basic validation
    if (!name || !industry) {
      res
        .status(400)
        .json({ success: false, error: "Name and industry are required" });
      return;
    }

    const result = await businessService.createBusiness({ name, industry });

    if (result.success) {
      res
        .status(201)
        .json({
          success: true,
          data: { id: result.id, business_id: result.businessId },
        });
    } else {
      res
        .status(500)
        .json({
          success: false,
          error: result.error || "Failed to create business",
        });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Export the router and services for testing purposes
export { router, businessService, transactionService };
