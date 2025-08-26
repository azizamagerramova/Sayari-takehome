import "./App.css";
import Graph from "./components/Graph/Trellis";
import TransactionTable from "./components/TransactionTable";
import TransactionDetails from "./components/TransactionDetails/TransactionDetails";
import Item from "@mui/material/Grid2";
import { Grid2 as Grid } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { useResizeDetector } from "react-resize-detector";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

function App() {
  const { ref: containerRef } = useResizeDetector();

  const darkTheme = createTheme({
    palette: {
      mode: "dark",
    },
  });

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: "100vh",
          }}
        >
          {/* Header */}
          <Grid
            container
            sx={{
              backgroundColor: "#000",
              color: "#fff",
              height: "50px",
            }}
          >
            <Item className="logo">SAYARI</Item>
          </Grid>

          {/* Main Content */}
          <Grid container className="container" ref={containerRef}>
            <Grid sx={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <Grid className="graph">
                <Graph onNodeClick={() => {}} />
              </Grid>
              <Grid
                sx={{
                  borderWidth: "2px",
                  borderStyle: "solid",
                  borderColor: "#000",
                  flex: 1,
                  padding: "20px",
                }}
              >
                <TransactionTable />
              </Grid>
            </Grid>
            <Grid sx={{ padding: "20px" }}>
              <TransactionDetails />
            </Grid>
          </Grid>

          {/* Footer Banner */}
          <Grid
            container
            sx={{
              backgroundColor: "#1d6e6b",
              color: "#fff",
              padding: "8px 0",
              textAlign: "center",
              letterSpacing: "1px",
              marginTop: "auto",
              fontSize: "12px",
              justifyContent: "center",
            }}
          >
            Developer Code Challenge v1.0
          </Grid>
        </div>
      </ThemeProvider>
    </LocalizationProvider>
  );
}

export default App;
