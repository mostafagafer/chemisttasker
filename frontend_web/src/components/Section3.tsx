import { forwardRef, Ref } from "react";

// material ui
import { Box, Container, Typography } from "@mui/material";

// styles
import {
  containerStyles,
  headerStyles,
  subHeaderStyles,
} from "../styles/global";

// interfaces
interface ISection3Props {
  id: string;
}

const Section3 = forwardRef(({ id }: ISection3Props, ref: Ref<HTMLElement>) => {
  return (
    <Container component="section" sx={containerStyles} id={id} ref={ref}>
      <Box>
        <Typography component="h2" sx={headerStyles} data-aos="fade-in">
          Access Clipboard anywhere
        </Typography>
        <Typography
          variant="subtitle1"
          component="p"
          sx={subHeaderStyles}
          data-aos="fade-in"
          data-aos-delay="200"
        >
          Whether you’re on the go, or at your computer, you can access all your
          Clipboard snippets in a few simple clicks.
        </Typography>
      </Box>
      <Box sx={{ mt: { xs: "6rem", md: 0 } }}>
        <img
          src="images/image-devices.png"
          alt="Snippets on Laptop"
          style={{ maxWidth: "100%"}}
          aria-hidden="true"
          data-aos="zoom-out"
          data-aos-delay="500"
        />
      </Box>
    </Container>
  );
});

export default Section3;
