import { useEffect, useRef } from "react";
import Typography from "@mui/material/Typography";
import { SidebarFooterProps } from "@toolpad/core/DashboardLayout";

export default function DashboardSidebarFooter({ mini }: SidebarFooterProps) {
  const footerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const drawerElement = footerRef.current?.closest<HTMLElement>(".MuiDrawer-root");
    const shellElement = footerRef.current?.closest<HTMLElement>("[data-dashboard-shell]");

    if (!drawerElement || !shellElement) {
      return undefined;
    }

    const { display } = window.getComputedStyle(drawerElement);
    if (display === "none") {
      return undefined;
    }

    shellElement.classList.toggle("dashboard-shell--collapsed", mini);

    return () => {
      shellElement.classList.remove("dashboard-shell--collapsed");
    };
  }, [mini]);

  return (
    <Typography ref={footerRef} variant="caption" sx={{ m: 1, whiteSpace: "nowrap", overflow: "hidden" }}>
      {mini ? "(c) CT" : `(c) ${new Date().getFullYear()} ChemistTasker`}
    </Typography>
  );
}
