import { PropsWithChildren, useCallback } from "react";
import Box from "@mui/material/Box";
import GlobalStyles from "@mui/material/GlobalStyles";
import { alpha } from "@mui/material/styles";
import IconButton from "@mui/material/IconButton";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";

export default function DashboardShell({ children }: PropsWithChildren) {
  const handleExpandClick = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }
    const expandButton = document.querySelector<HTMLButtonElement>('[aria-label^="Expand navigation menu"]');
    expandButton?.click();
  }, []);

  return (
    <>
      <GlobalStyles
        styles={(theme) => ({
          '[data-dashboard-shell] .MuiDrawer-root.MuiDrawer-docked': {
            transition: theme.transitions.create("width", {
              duration: theme.transitions.duration.shorter,
            }),
          },
          '[data-dashboard-shell] .MuiDrawer-root.MuiDrawer-docked .MuiDrawer-paper': {
            transition: theme.transitions.create("width", {
              duration: theme.transitions.duration.shorter,
            }),
          },
          '[data-dashboard-shell].dashboard-shell--collapsed .MuiDrawer-root.MuiDrawer-docked': {
            width: theme.spacing(2.25),
            border: "none",
          },
          '[data-dashboard-shell].dashboard-shell--collapsed .MuiDrawer-root.MuiDrawer-docked .MuiDrawer-paper': {
            width: theme.spacing(2.25),
            borderRight: "none",
            overflow: "hidden",
            position: "relative",
            backgroundColor: alpha(theme.palette.primary.main, 0.06),
            "&::after": {
              content: '""',
              position: "absolute",
              top: "50%",
              right: "-14px",
              transform: "translateY(-50%)",
              width: theme.spacing(3),
              height: theme.spacing(9),
              borderRadius: "0 12px 12px 0",
              background: theme.palette.background.paper,
              boxShadow: theme.shadows[6],
              border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
              pointerEvents: "none",
            },
          },
          '[data-dashboard-shell].dashboard-shell--collapsed .MuiDrawer-root.MuiDrawer-docked nav': {
            visibility: "hidden",
            pointerEvents: "none",
          },
          '[data-dashboard-shell].dashboard-shell--collapsed .MuiDrawer-root.MuiDrawer-docked .MuiToolbar-root': {
            minHeight: 0,
            visibility: "hidden",
          },
          '[data-dashboard-shell].dashboard-shell--collapsed button[aria-label^="Expand navigation menu"]': {
            minWidth: theme.spacing(4),
            padding: theme.spacing(0.5),
            borderRadius: 999,
            boxShadow: theme.shadows[6],
            background: theme.palette.background.paper,
            color: theme.palette.text.primary,
            "& svg": {
              fontSize: "1.1rem",
            },
            "&::after": {
              content: '""',
            },
          },
          '[data-dashboard-shell] button[aria-label^="Collapse navigation menu"]': {
            borderRadius: 999,
            fontSize: "0.75rem",
            fontWeight: 600,
            letterSpacing: "0.06em",
            display: "inline-flex",
            alignItems: "center",
            gap: theme.spacing(1),
            "&::after": {
              content: '"Close"',
            },
          },
          '[data-dashboard-shell] button[aria-label$="navigation menu"]': {
            transition: theme.transitions.create(["background-color", "box-shadow", "color"], {
              duration: theme.transitions.duration.shortest,
            }),
          },
          '[data-dashboard-shell] [data-sidebar-handle]': {
            display: "none",
            position: "fixed",
            top: "50%",
            left: theme.spacing(2.25),
            transform: "translateY(-50%)",
            zIndex: theme.zIndex.drawer + 2,
            boxShadow: theme.shadows[6],
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
            color: theme.palette.primary.main,
            "&:hover": {
              backgroundColor: alpha(theme.palette.primary.main, 0.12),
            },
          },
          '[data-dashboard-shell].dashboard-shell--collapsed [data-sidebar-handle]': {
            display: "flex",
          },
        })}
      />
      <Box data-dashboard-shell sx={{ minHeight: "100vh", position: "relative" }}>
        {children}
        <IconButton
          data-sidebar-handle
          size="small"
          aria-label="Expand navigation menu from edge"
          onClick={handleExpandClick}
        >
          <KeyboardDoubleArrowRightIcon fontSize="small" />
        </IconButton>
      </Box>
    </>
  );
}
