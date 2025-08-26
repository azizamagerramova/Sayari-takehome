import { v4 as uuidv4 } from "uuid";
import * as businessRepo from "../repositories/businessRepository";
import * as graphRepo from "../repositories/graphRepository";
import { Business, CreateBusinessDto } from "../types";

/**
 * Get all businesses
 */
export const getAllBusinesses = async (): Promise<Business[]> => {
  return await businessRepo.findAllBusinesses();
};

/**
 * Get a business by ID
 */
export const getBusinessById = async (
  businessId: string
): Promise<Business | null> => {
  return await businessRepo.findBusinessById(businessId);
};

/**
 * Get multiple businesses by IDs
 */
export const getBusinessesByIds = async (
  businessIds: string[]
): Promise<Business[]> => {
  const { nameMap, industryMap } = await businessRepo.getBusinessDetails(
    businessIds
  );

  return businessIds
    .map((businessId) => ({
      business_id: businessId,
      name: nameMap[businessId],
      industry: industryMap[businessId],
    }))
    .filter((b) => b.name); // Filter out any businesses that weren't found
};

/**
 * Create a new business in both SQLite and Memgraph
 */
export const createBusiness = async (
  dto: CreateBusinessDto
): Promise<{
  success: boolean;
  id?: number;
  businessId?: string;
  error?: string;
}> => {
  const businessId = uuidv4();

  try {
    // Create in SQLite first
    const sqliteResult = await businessRepo.createBusiness(
      businessId,
      dto.name,
      dto.industry
    );

    // Then create in Memgraph
    await graphRepo.createOrFindNode(businessId);

    return {
      success: true,
      id: sqliteResult.id,
      businessId: businessId,
    };
  } catch (error) {
    // If Memgraph fails, we should ideally rollback SQLite
    // For now, we'll just log and return error
    console.error("Error creating business:", error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
};

/**
 * Get transaction count for a specific business
 */
export const getBusinessTransactionCount = async (
  businessId: string
): Promise<{ businessId: string; transactionCount: number }> => {
  const transactionCount = await graphRepo.countEdgesByNode(businessId);
  return { businessId, transactionCount };
};
