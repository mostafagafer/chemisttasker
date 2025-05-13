import { useEffect } from "react";

//material ui
import { Stack, Button, Theme, lighten } from "@mui/material";
import { ArrowDropUpRounded, ArrowDropDownRounded } from "@mui/icons-material";

// styles
import {
  navContainerStyles,
  circleStyles,
  arrowStyles,
} from "../styles/sectionNavigation";

//interfaces
interface ISectionNavigationProps {
  sectionsInView: Array<boolean>;
}

const SectionNavigation = ({ sectionsInView }: ISectionNavigationProps) => {
  // event handler for left/right arrow navigation
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      navigateSection(true);
    } else if (e.key === "ArrowLeft") {
      navigateSection(false);
    }
  };

  // navigates to the next or previous section based on passed value
  // 0: previous | 1: next
  const navigateSection = (direction: boolean) => {
    let navSectionId: number;
    // get index of current section that's in view
    const index = sectionsInView.indexOf(true);
    // if direction is true (next item)
    if (direction) {
      // if we're at the last section do nothing
      if (index === sectionsInView.length - 1) return;
      // +2 is because section ids start at 1
      // so if #section1 (index 0) is in view
      // we need to navigato to #section2 (2 = index+2)
      navSectionId = index + 2;
    }
    // if direction is false (previous item)
    else {
      // if we're at the first section do nothing
      if (index === 0) return;
      // section ids start at 1 so index is already id-1
      navSectionId = index;
    }
    // navigate to the section id
    navigateTo(navSectionId);
  };

  // navigates to a section based on passed id number
  const navigateTo = (id: number) => {
    // get section element to navigate to
    const navToElement = document.getElementById("section" + id);
    // get container element
    const containerElement = document.getElementById("section-container");
    // get top position of the section element
    const position = navToElement?.getBoundingClientRect().y || 0;
    // fix for crollTo not triggering in chrome
    setTimeout(() => {
      // scroll to position of top of the element + scroll amount of the container element
      containerElement?.scrollTo(0, position + containerElement?.scrollTop);
    }, 1);
  };

  // adding event listener for keyboard navigation
  useEffect(() => {
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [sectionsInView]);

  return (
    <Stack sx={navContainerStyles}>
      <Button
        sx={arrowStyles}
        onClick={() => navigateSection(false)}
        disableRipple
        //disable if first section is in view
        disabled={sectionsInView[0] ? true : false}
        aria-label="Previous Section"
      >
        <ArrowDropUpRounded fontSize="inherit" />
      </Button>
      {sectionsInView.map((_, index) => (
        <Stack
          width={14}
          height={14}
          alignItems="center"
          justifyContent="center"
          key={index}
        >
          <Button
            // merging styles
            sx={[
              (theme: Theme) => ({
                width: sectionsInView[index] ? 14 : 8,
                height: sectionsInView[index] ? 14 : 8,
                backgroundColor: sectionsInView[index]
                  ? theme.palette.darkGrayishBlue.main
                  : lighten(theme.palette.grayishBlue.main, 0.3),
              }),
              (theme: Theme) => circleStyles(theme),
            ]}
            onClick={() => navigateTo(index + 1)}
            // set active to true if same section is in view
            data-active={sectionsInView[index] ? true : false}
            disableRipple
            aria-label={`Go to Section ${index + 1}`}
          />
        </Stack>
      ))}
      <Button
        sx={arrowStyles}
        onClick={() => navigateSection(true)}
        disableRipple
        //disable if last section is in view
        disabled={sectionsInView[sectionsInView.length - 1] ? true : false}
        aria-label="Next Section"
      >
        <ArrowDropDownRounded fontSize="inherit" />
      </Button>
    </Stack>
  );
};

export default SectionNavigation;
