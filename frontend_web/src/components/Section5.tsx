import { forwardRef, Ref } from "react";

// components
import Footer from "./Footer";
import ButtonSection from "./ButtonSection";

// material ui
import { Typography, Stack, Container } from "@mui/material";

// styles
import {
  containerStyles,
  headerStyles,
  subHeaderStyles,
} from "../styles/global";

// interfaces
interface ISection5Props {
  id: string;
}

const Section5 = forwardRef(({ id }: ISection5Props, ref: Ref<HTMLElement>) => {
  return (
    <Container
      component="section"
      id={id}
      sx={[containerStyles, { alignItems: "stretch" }]}
      ref={ref}
      disableGutters
    >
      <Stack
        sx={{ flexGrow: 1, alignItems: "center", justifyContent: "center" }}
      >
        <Typography component="h2" sx={headerStyles} data-aos="fade-in">
          Clipboard for iOS and Mac OS
        </Typography>
        <Typography
          sx={subHeaderStyles}
          data-aos="fade-in"
          data-aos-delay="200"
        >
          Available for free on the App Store. Download for Mac or iOS, sync
          with iCloud and you’re ready to start adding to your clipboard.
        </Typography>
        <ButtonSection />
      </Stack>
      <Footer />
    </Container>
  );
});

export default Section5;
