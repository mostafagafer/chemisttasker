import { AppBar, Box, Container, Toolbar } from "@mui/material";
import logoBanner from "../assets/logo-banner.jpg";

export default function PublicLogoTopBar() {
  return (
    <AppBar
      position="sticky"
      sx={{
        bgcolor: "rgba(255,255,255,0.8)",
        backdropFilter: "blur(10px)",
        boxShadow: "none",
        borderBottom: "1px solid #e2e8f0",
      }}
    >
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ justifyContent: "space-between" }}>
          <a href="/" style={{ display: "flex", alignItems: "center" }}>
            <img
              src={logoBanner}
              alt="ChemistTaskerRx Logo"
              style={{ height: "48px", width: "auto" }}
            />
          </a>
          <Box />
        </Toolbar>
      </Container>
    </AppBar>
  );
}

