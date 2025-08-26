import express, { Request, Response } from "express";
import * as transactionService from "../services/transactionService";
import * as transactionSimulatorService from "../services/transactionSimulatorService";
import * as graphService from "../services/graphService";
import * as graphRepo from "../repositories/graphRepository";
import { emitGraphUpdate } from "../services/notificationService";
import { Server } from "socket.io";

const router = express.Router();
let running = false;
let intervalId: NodeJS.Timeout | undefined | undefined;
const DEFAULT_RATE_SECONDS = 3; // every 3s
const DEFAULT_INTERVAL_SECONDS = DEFAULT_RATE_SECONDS * 1000;

/**
 * GET /api/transactions
 * Retrieve all transactions
 */
router.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const transactions = await transactionService.getAllTransactions();
    res.json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/transactions/nodes
 * Get all business nodes with enriched industry data
 */
router.get("/nodes", async (_req: Request, res: Response): Promise<void> => {
  try {
    const { nodes } = await graphService.getEnrichedGraphData();
    res.json({ success: true, data: nodes });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/transactions/edges
 * Get all transaction edges between businesses
 */
router.get("/edges", async (_req: Request, res: Response): Promise<void> => {
  try {
    const edges = await graphRepo.getAllEdges();
    res.json({ success: true, data: edges });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/transactions/filter
 * Filter transactions by business, date range, or amount
 */
router.get("/filter", async (req: Request, res: Response): Promise<void> => {
  const { from, to, startDate, endDate, minAmount, maxAmount } = req.query;
  try {
    const filteredTransactions =
      await transactionService.getFilteredTransactions(
        from as string | undefined,
        to as string | undefined,
        startDate as string | undefined,
        endDate as string | undefined,
        minAmount as string | undefined,
        maxAmount as string | undefined
      );
    res.json({ success: true, data: filteredTransactions });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/transactions
 * Create a new transaction between two businesses
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { from, to, amount, timestamp } = req.body;
  try {
    // Create the transaction
    const transaction = await transactionService.createTransaction({
      from,
      to,
      amount,
      timestamp,
    });

    // Get enriched data for notification
    const enrichedTransaction = await transactionService.enrichTransaction({
      from,
      to,
      amount,
      timestamp,
    });

    // Emit an event to all connected clients
    const io = req.app.get("io") as Server | undefined;
    await emitGraphUpdate(io, enrichedTransaction);

    res.json({ success: true, data: transaction });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/transactions/generate-mock-transactions
 * Create a number of specified transactions between two randomly chosen businesses
 */
router.post(
  "/generate-mock-transactions",
  async (req: Request, res: Response) => {
    const { numTransactions } = req.body;

    if (numTransactions < 1) {
      return res
        .status(400)
        .json({ success: false, error: "numTransactions must be >= 1" });
    }

    try {
      const results =
        await transactionSimulatorService.generateMockTransactions(
          numTransactions
        );

      return res.status(201).json({ success: true, data: results });
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, error: (error as Error).message });
    }
  }
);

/**
 * POST /api/transactions/start-generating-mock-transactions
 * Keeps creating new transactions in batches of specified size every RATE_SECONDS seconds
 */
router.post(
  "/start-generating-mock-transactions",
  async (req: Request, res: Response) => {
    const { numTransactions, intervalSeconds } = req.body;

    const intervalToRun = intervalSeconds * 1000 || DEFAULT_INTERVAL_SECONDS;

    if (numTransactions < 1 || numTransactions > 100) {
      return res.status(400).json({
        success: false,
        error: "numTransactions must be >= 1 and < 100",
      });
    }

    if (running) {
      return res.status(400).json({
        success: false,
        error: "transaction generation service is already running",
      });
    }

    try {
      running = true;

      await transactionSimulatorService.generateMockTransactions(
        numTransactions
      );

      intervalId = setInterval(() => {
        transactionSimulatorService
          .generateMockTransactions(numTransactions)
          .catch((err) => console.error("generator error:", err));
      }, intervalToRun);

      return res.status(201).json({
        success: true,
        message: "started transaction generation service",
        intervalSeconds: intervalToRun / 1000,
        numTransactions,
      });
    } catch (error) {
      running = false;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
      return res
        .status(500)
        .json({ success: false, error: (error as Error).message });
    }
  }
);

/**
 * POST /api/transactions/stop-generating-mock-transactions
 * Stops generation of new mock transactions
 */
router.post(
  "/stop-generating-mock-transactions",
  async (_req: Request, res: Response) => {
    if (!running) {
      return res.status(400).json({
        success: false,
        error: "transaction generation service is not running",
      });
    }

    running = false;
    clearInterval(intervalId);
    return res.json({
      success: true,
      message: "stopped transaction generation service",
    });
  }
);
export default router;
