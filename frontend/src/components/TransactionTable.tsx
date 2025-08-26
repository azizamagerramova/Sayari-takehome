import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  TableSortLabel,
} from "@mui/material";
import { getSocket } from "../services/socket";

type Business = {
  business_id: string;
  name: string;
  industry: string;
  totalTransactions?: number;
};

type GraphNode = {
  id: string;
  label: string;
  industry?: string;
};

const TransactionTable = () => {
  const [businessData, setBusinessData] = useState<Business[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newBusiness, setNewBusiness] = useState<Business | null>(null);

  // Pagination State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // Sorting State - default to transaction count descending
  const [sortBy, setSortBy] = useState<
    "name" | "industry" | "totalTransactions"
  >("totalTransactions");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Function to fetch business data and transaction counts
  const fetchBusinessData = async (isInitialLoad = false) => {
    try {
      // Only show loading indicator on initial load
      if (isInitialLoad) {
        setLoading(true);
      }
      // Fetch businesses
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(`${apiUrl}/api/businesses`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const result = await response.json();
      const businesses = result.data || [];

      // Fetch transaction counts for each business
      const countsMap: { [key: string]: number } = {};
      for (const business of businesses) {
        try {
          const countResponse = await fetch(
            `${
              import.meta.env.VITE_API_URL || "http://localhost:3000"
            }/api/businesses/${business.business_id}/transaction-count`
          );
          if (countResponse.ok) {
            const countData = await countResponse.json();

            countsMap[business.business_id] =
              countData.data.transactionCount || 0; // Fixed  a bug here countData.transactionCount wasn't getting the transaction count
          }
        } catch (err) {
          console.error(
            `Failed to fetch transaction count for ${business.name}:`,
            err
          );
        }
      }

      // Combine business data with transaction counts
      const enrichedBusinesses = businesses.map((business: Business) => ({
        ...business,
        totalTransactions: countsMap[business.business_id] || 0,
      }));

      setBusinessData(enrichedBusinesses);
      return true;
    } catch (err: unknown) {
      setError((err as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Fetch initial business data
  useEffect(() => {
    fetchBusinessData(true); // Pass true for initial load
  }, []);

  // WebSocket connection for live updates
  useEffect(() => {
    // Get the shared socket instance
    const socket = getSocket();

    // Function to find business ID from either direct ID or node data
    const getBusinessId = (idOrObj: any): string | null => {
      if (typeof idOrObj === "string") return idOrObj;
      if (idOrObj && idOrObj.id) return idOrObj.id;
      return null;
    };

    // Define event handlers
    const handleGraphUpdate = async (data: {
      nodes?: GraphNode[];
      newTransaction?: {
        from: string | { id: string };
        to: string | { id: string };
        amount: number;
        timestamp: string;
      };
    }) => {
      if (data && data.newTransaction) {
        const transaction = data.newTransaction;
        const fromId = getBusinessId(transaction.from);
        const toId = getBusinessId(transaction.to);

        if (!fromId) {
          console.error(
            "Could not determine source business ID from transaction",
            transaction
          );
          return;
        }

        console.log(
          `New transaction from ${fromId} to ${toId || "unknown"} for ${
            transaction.amount
          }`
        );

        let updatedBusiness: Business | null = null;

        setBusinessData((prevBusinessData) => {
          const updatedBusinessData = prevBusinessData.map((business) => {
            if (business.name === fromId || business.name === toId) {
              setNewBusiness(business);
              setTimeout(() => setNewBusiness(null), 3000);
              // fixed a bug: we are using business name and not business id in notifications socket
              return {
                ...business,
                totalTransactions: (business.totalTransactions || 0) + 1,
              };
            }
            return business;
          });
          return updatedBusinessData;
        });
      }
    };

    const handleInitialData = (data: { nodes?: GraphNode[] }) => {
      if (data && data.nodes && Array.isArray(data.nodes)) {
        console.log("Received initialData with", data.nodes.length, "nodes");
      }
    };

    // Register event listeners
    socket.on("graphUpdate", handleGraphUpdate);
    socket.on("initialData", handleInitialData);
    // Cleanup: remove event listeners on unmount
    return () => {
      socket.off("graphUpdate", handleGraphUpdate);
      socket.off("initialData", handleInitialData);
    };
  }, []);

  // Handle pagination changes
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0); // Reset to first page
  };

  // Handle sorting
  const handleSort = (property: "name" | "industry" | "totalTransactions") => {
    const isAsc = sortBy === property && sortDirection === "asc";
    setSortDirection(isAsc ? "desc" : "asc");
    setSortBy(property);
  };

  // Apply sorting
  const sortedData = [...businessData].sort((a, b) => {
    const valueA = a[sortBy];
    const valueB = b[sortBy];

    if (typeof valueA === "number" && typeof valueB === "number") {
      return sortDirection === "asc" ? valueA - valueB : valueB - valueA;
    }

    if (typeof valueA === "string" && typeof valueB === "string") {
      return sortDirection === "asc"
        ? valueA.localeCompare(valueB)
        : valueB.localeCompare(valueA);
    }

    return 0;
  });
  // Paginated data

  const paginatedData = sortedData.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div style={{ position: "relative" }}>
      <TableContainer component={Paper}>
        <Table aria-label="Transaction Summary Table">
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortBy === "name"}
                  direction={sortDirection}
                  onClick={() => handleSort("name")}
                >
                  <b>Business</b>
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortBy === "industry"}
                  direction={sortDirection}
                  onClick={() => handleSort("industry")}
                >
                  <b>Industry</b>
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={sortBy === "totalTransactions"}
                  direction={sortDirection}
                  onClick={() => handleSort("totalTransactions")}
                  sx={{ "& .MuiTableSortLabel-icon": { opacity: 1 } }}
                >
                  <b>Total Transactions</b>
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedData.map((row, index) => {
              // Check if this is the updated business that was just involved in a transaction

              const isUpdatedBusiness =
                newBusiness && newBusiness.business_id === row.business_id;

              return (
                <TableRow
                  key={row.business_id || index}
                  className={isUpdatedBusiness ? "new-transaction-row" : ""}
                  sx={
                    isUpdatedBusiness
                      ? {
                          backgroundColor: "rgba(0, 191, 255, 0.1)",
                          transition: "background-color 3s ease-out",
                        }
                      : {}
                  }
                >
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.industry}</TableCell>
                  <TableCell align="right">{row.totalTransactions}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {/* Pagination */}
      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={businessData.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </div>
  );
};

export default TransactionTable;
