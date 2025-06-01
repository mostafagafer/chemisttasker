import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import ComingSoon from "../components/ComingSoon";

// Customize your theme if you want (colors, font)
const theme = createTheme({
  typography: {
    fontFamily: "'Bai Jamjuree', 'sans-serif';",
  },
});

function LandingPage() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ComingSoon logoUrl="images/logo_cropped.jpg" />
      {/* If your logo is elsewhere, update the path above */}
    </ThemeProvider>
  );
}

export default LandingPage;
