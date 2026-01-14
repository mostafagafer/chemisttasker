// src/theme/sleekTheme.tsx
import * as React from "react";
import { createTheme, alpha, Theme } from "@mui/material/styles";
import { ThemeProvider, CssBaseline, useMediaQuery } from "@mui/material";

type Mode = "light" | "dark";

// Indigo-ish primary that matches your mock
const primary = {
  50:"#eef2ff",100:"#e0e7ff",200:"#c7d2fe",300:"#a5b4fc",400:"#818cf8",
  500:"#6366f1",600:"#4f46e5",700:"#4338ca",800:"#3730a3",900:"#312e81",
};

// Greys
const grey = {
  50:"#f8fafc",100:"#f1f5f9",200:"#e2e8f0",300:"#cbd5e1",400:"#94a3b8",
  500:"#64748b",600:"#475569",700:"#334155",800:"#1f2937",900:"#0f172a",
};

// Dark rail/paper used in dashboard
const greyDark = {
  bg: "#0b1220",
  paper: "#0f172a",
  700:"#334155",
  600:"#475569",
  500:"#64748b",
  400:"#94a3b8",
  300:"#cbd5e1",
  divider: "rgba(148,163,184,0.24)",
};

export function createSleekTheme(mode: Mode): Theme {
  const isLight = mode === "light";

  // Sidebar states tuned for contrast
  const selectedBg = isLight
    ? alpha(primary[600], 0.10)
    : alpha(primary[400], 0.18);
  const hoverBg = isLight
    ? alpha(grey[200], 0.50)
    : alpha("#ffffff", 0.06);

  return createTheme({
    shape: { borderRadius: 14 },
    palette: {
      mode,
      primary: { main: primary[600] },
      background: isLight
        ? { default: grey[50], paper: "#fff" }
        : { default: greyDark.bg, paper: greyDark.paper },
      divider: isLight ? grey[200] : greyDark.divider,
      text: isLight
        ? { primary: grey[900], secondary: grey[600] }
        : { primary: greyDark[300], secondary: greyDark[500] },
    },
    typography: {
      fontFamily: [
        "Inter", "SF Pro Text", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif",
      ].join(","),
      h1: { fontWeight: 800 }, h2: { fontWeight: 800 }, h3: { fontWeight: 700 },
    },
    components: {
      // Soft app bar
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: alpha(isLight ? "#ffffff" : greyDark.paper, 0.85),
            backdropFilter: "blur(6px)",
            borderBottom: `1px solid ${isLight ? grey[200] : greyDark.divider}`,
          },
        },
      },

      // Paper: subtle borders / shadows
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            border: `1px solid ${isLight ? grey[200] : greyDark.divider}`,
            boxShadow: isLight
              ? "0 1px 2px rgba(15,23,42,0.04)"
              : "0 1px 2px rgba(0,0,0,0.25)",
            borderRadius: 14,
            backgroundImage: "none",
          },
        },
      },

      // -------- Sidebar polish (works with Toolpad’s List-based sidebar) -------
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isLight ? "#fff" : greyDark.paper,
            borderRight: `1px solid ${isLight ? grey[200] : greyDark.divider}`,
          },
        },
      },
      MuiListSubheader: {
        styleOverrides: {
          root: {
            color: isLight ? grey[600] : greyDark[500],
            lineHeight: 1.2,
            fontSize: "0.72rem",
            textTransform: "uppercase",
            letterSpacing: ".06em",
            fontWeight: 700,
            paddingTop: 12,
            paddingBottom: 6,
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: {
          root: {
            minWidth: 32,
            color: isLight ? grey[600] : greyDark[500],
          },
        },
      },
      MuiListItemText: {
        styleOverrides: {
          primary: { fontWeight: 600 },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            margin: "2px 8px",
            borderRadius: 12,
            paddingTop: 8,
            paddingBottom: 8,
            "&:hover": {
              backgroundColor: hoverBg,
            },
            "&.Mui-selected": {
              backgroundColor: selectedBg,
              border: `1px solid ${isLight ? alpha(primary[600], 0.25) : alpha(primary[300], 0.35)}`,
              color: isLight ? primary[700] : primary[300],
              "& .MuiListItemIcon-root": {
                color: isLight ? primary[700] : primary[300],
              },
              "&:hover": {
                backgroundColor: isLight
                  ? alpha(primary[600], 0.16)
                  : alpha(primary[400], 0.26),
              },
            },
          },
        },
      },
      // Chips used in your header (“Verified”, etc.)
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 999 },
          outlined: {
            borderColor: isLight ? grey[200] : greyDark.divider,
            backgroundColor: isLight ? grey[50] : "transparent",
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 12, textTransform: "none", fontWeight: 600 },
          outlined: {
            borderColor: isLight ? grey[200] : greyDark.divider,
            backgroundColor: "transparent",
          },
        },
      },
      MuiCardHeader: {
        styleOverrides: {
          root: { borderBottom: `1px solid ${isLight ? grey[200] : greyDark.divider}` },
        },
      },
    },
  });
}

// ---------------- Color mode provider (persisted + system preference) --------
type ColorModeContextValue = {
  mode: Mode;
  toggleColorMode: () => void;
  setMode: (m: Mode) => void;
};

const ColorModeContext = React.createContext<ColorModeContextValue | undefined>(undefined);
const STORAGE_KEY = "ct-theme-mode";

export function useColorMode(): ColorModeContextValue {
  const ctx = React.useContext(ColorModeContext);
  if (!ctx) throw new Error("useColorMode must be used within ColorModeProvider");
  return ctx;
}

export function ColorModeProvider({ children }: { children: React.ReactNode }) {
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const [mode, setModeState] = React.useState<Mode>(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) || "").toLowerCase();
    if (saved === "light" || saved === "dark") return saved as Mode;
    return prefersDark ? "dark" : "light";
  });

  const setMode = (m: Mode) => {
    setModeState(m);
    localStorage.setItem(STORAGE_KEY, m);
  };
  const toggleColorMode = () => setMode(mode === "light" ? "dark" : "light");

  React.useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) setMode(prefersDark ? "dark" : "light");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersDark]);

  const theme = React.useMemo(() => createSleekTheme(mode), [mode]);
  const value = React.useMemo(() => ({ mode, toggleColorMode, setMode }), [mode]);

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
