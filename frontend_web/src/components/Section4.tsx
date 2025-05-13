import { forwardRef, Ref } from "react";

// material ui
import { Box, Container, Typography, Grid, Paper } from "@mui/material";

// styles
import {
  containerStyles,
  headerStyles,
  subHeaderStyles,
} from "../styles/global";
import { paperSubTitleStyles, paperStyles } from "../styles/section4";

// interfaces
interface ISection4Props {
  id: string;
}

const Section4 = forwardRef(({ id }: ISection4Props, ref: Ref<HTMLElement>) => {
  return (
    <Container component="section" sx={containerStyles} id={id} ref={ref}>
      <Box>
        <Typography
          variant="h4"
          component="h2"
          sx={headerStyles}
          data-aos="fade-in"
        >
          What do peaople say
        </Typography>
        <Typography
          variant="subtitle1"
          component="p"
          sx={subHeaderStyles}
          data-aos="fade-in"
          data-aos-delay="200"
        >
          We’ve got the tools to boost your productivity.
        </Typography>
      </Box>
      <Grid
        container
        sx={{
          mt: { xs: 10, md: 0 },
          justifyContent: "center",
          gap: { xs: 2, md: 0 },
        }}
      >
        <Grid item xs={12} md={3}>
          <Paper
            sx={paperStyles}
            elevation={0}
            data-aos="fade-right"
            data-aos-delay="600"
          >
            <img src="images/icon-blacklist.svg" alt="" aria-hidden="true" />
            <Typography
              variant="h5"
              component="h3"
              fontWeight="600"
              sx={{ mt: 4 }}
            >
              Sarah M
            </Typography>
            <Typography component="p" variant="subtitle1" sx={paperSubTitleStyles}>
              ChemistTasker made finding relief work so much easier. The
              verification process gives me confidence in the platform.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper
            sx={paperStyles}
            elevation={0}
            data-aos="fade-in"
            data-aos-delay="400"
          >
            <img src="images/icon-text.svg" alt="" aria-hidden="true" />
            <Typography
              variant="h5"
              component="h3"
              fontWeight="600"
              sx={{ mt: 4 }}
            >
              John D
            </Typography>
            <Typography component="p" variant="subtitle1" sx={paperSubTitleStyles}>
              As a pharmacy owner, this platform has saved us countless hours
              in staff coordination.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper
            sx={paperStyles}
            elevation={0}
            data-aos="fade-left"
            data-aos-delay="600"
          >
            <img src="images/icon-preview.svg" alt="" aria-hidden="true" />
            <Typography
              variant="h5"
              component="h3"
              fontWeight="600"
              sx={{ mt: 4 }}
            >
              Michael R
            </Typography>
            <Typography component="p" variant="subtitle1" sx={paperSubTitleStyles}>
              The badge system really helps showcase my skills and experience
              to potential employers.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
      {/* <Grid
        container
        sx={{
          mt: { xs: 9, md: 0 },
          alignItems: "center",
          justifyContent: "center",
          gap: { xs: 7, md: 0 },
          "& img": { width: { xs: "8.5rem", md: "7.5rem", lg: "auto" } },
        }}
      >
        <Grid
          item
          xs={12}
          md={2}
          textAlign="center"
          data-aos="fade-up"
          data-aos-delay="1300"
        >
          <img
            src="images/logo-google.png"
            alt="Google Logo"
            aria-hidden="true"
          />
        </Grid>
        <Grid
          item
          xs={12}
          md={2}
          textAlign="center"
          data-aos="fade-up"
          data-aos-delay="1000"
        >
          <img src="images/logo-ibm.png" alt="IBM Logo" aria-hidden="true" />
        </Grid>
        <Grid
          item
          xs={12}
          md={2}
          textAlign="center"
          data-aos="fade-up"
          data-aos-delay="700"
        >
          <img
            src="images/logo-microsoft.png"
            alt="Microsoft Logo"
            aria-hidden="true"
          />
        </Grid>
        <Grid
          item
          xs={12}
          md={2}
          textAlign="center"
          data-aos="fade-up"
          data-aos-delay="1000"
        >
          <img src="images/logo-hp.png" alt="HP Logo" aria-hidden="true" />
        </Grid>
        <Grid
          item
          xs={12}
          md={2}
          textAlign="center"
          data-aos="fade-up"
          data-aos-delay="1300"
        >
          <img
            src="images/logo-vector-graphics.png"
            alt="Vector Graphics Logo"
            aria-hidden="true"
          />
        </Grid>
      </Grid> */}
    </Container>
  );
});

export default Section4;
