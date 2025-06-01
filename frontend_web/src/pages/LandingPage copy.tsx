import { useEffect } from "react";
import { useInView } from "react-intersection-observer";

// aos
import AOS from "aos";
import "aos/dist/aos.css";

// components
import Section1 from "../components/Section1";
import Section2 from "../components/Section2";
import Section3 from "../components/Section3";
import Section4 from "../components/Section4";
import Section5 from "../components/Section5";
import SectionNavigation from "../components/SectionNavigation";

// types
import { sectionRefType } from "../styles/app";

// styles
import { rootContainerStyles } from "../styles/app";

// material ui
import { CssBaseline, Box, useMediaQuery } from "@mui/material";

// customizing material-ui theme

// material-ui theme utilities
import {
  ThemeProvider,
  createTheme,
  PaletteColor,
  SimplePaletteColorOptions,
} from "@mui/material/styles";

// interfaces
declare module "@mui/material/styles" {
  interface Palette {
    strongCyan: PaletteColor;
    lightBlue: PaletteColor;
    darkGrayishBlue: PaletteColor;
    grayishBlue: PaletteColor;
  }

  interface PaletteOptions {
    strongCyan: SimplePaletteColorOptions;
    lightBlue: SimplePaletteColorOptions;
    darkGrayishBlue: SimplePaletteColorOptions;
    grayishBlue: SimplePaletteColorOptions;
  }
}

// theme colors and font
const theme = createTheme({
  palette: {
    strongCyan: { main: "hsl(171, 66%, 44%)" },
    lightBlue: { main: "hsl(233, 100%, 69%)" },
    darkGrayishBlue: { main: "hsl(210, 10%, 33%)" },
    grayishBlue: { main: "hsl(201, 11%, 66%)" },
    text: {
      primary: "hsl(210, 10%, 33%)",
      secondary: "hsl(201, 11%, 66%)",
    },
  },
  typography: {
    fontFamily: "'Bai Jamjuree', 'sans-serif';",
  },
});

// end of customizing material-ui theme

function LandingPage() {
  // using "react-intersection-observer"'s useInView hook
  // to detect when a secion is in view
  let sectionRef: Array<sectionRefType> = [];
  let sectionInView: Array<boolean> = [];
  const threshold = 0.5;
  for (let i: number = 0; i < 5; i++)
    [sectionRef[i], sectionInView[i]] = useInView({ threshold: threshold });

  const matches = useMediaQuery(theme.breakpoints.up("md"));

  // scroll handler for adding/removing aoe-animation class
  const scrollHandler = () => {
    const aosElements = document.querySelectorAll("[data-aos]");
    let observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.intersectionRatio > 0.25) {
          entry.target.classList.add("aos-animate");
        } else {
          // enable re-animation only on bigger screens
          matches && entry.target.classList.remove("aos-animate");
        }
      });
    });
    aosElements.forEach((element) => {
      observer.observe(element);
    });
  };

  useEffect(() => {
    // AOS initialization
    AOS.init({ anchorPlacement: "top-bottom", duration: 2000 });
  }, []);

  useEffect(() => {
    // remove animation delay on small screens
    if (!matches)
      document.querySelectorAll("[data-aos]").forEach((element) => {
        element.removeAttribute("data-aos-delay");
      });
    // fix for scrolling inside a container instead of window
    document.addEventListener("scroll", scrollHandler, {
      capture: true,
      passive: true,
    });
    return () => document.removeEventListener("scroll", scrollHandler);
  }, [matches]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box component="main" sx={rootContainerStyles} id="section-container">
        <Section1 id="section1" ref={sectionRef[0]} />
        <Section2 id="section2" ref={sectionRef[1]} />
        <Section3 id="section3" ref={sectionRef[2]} />
        <Section4 id="section4" ref={sectionRef[3]} />
        <Section5 id="section5" ref={sectionRef[4]} />
      </Box>
      {/* show navigation only on larger screens */}
      {matches && <SectionNavigation sectionsInView={sectionInView} />}
    </ThemeProvider>
  );
}

export default LandingPage;
