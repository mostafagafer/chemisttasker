import { forwardRef, Ref } from "react";

// material ui
import {
  Box,
  Container,
  Typography,
  Stack,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";

// styles
import {
  containerStyles,
  headerStyles,
  subHeaderStyles,
} from "../styles/global";
import {
listItemHeaderStyles,
listItemSubHeaderStyle,
} from "../styles/section2";

// interfaces
interface ISection2Props {
  id: string;
}

const Section2 = forwardRef(({ id }: ISection2Props, ref: Ref<HTMLElement>) => {
  return (
    <Container component="section" sx={containerStyles} id={id} ref={ref}>
      <Box>
        <Typography component="h2" sx={headerStyles} data-aos="fade-in">
          Keep track of your work
        </Typography>
        <Typography
          sx={subHeaderStyles}
          data-aos="fade-in"
          data-aos-delay="200"
        >
            ChemistTasker is a cutting-edge digital platform purpose-built to transform pharmacy 
            staffing across Australia. Designed with both efficiency and user experience in mind.
        </Typography>
      </Box>
      <Stack
        sx={{
          mt: { xs: 6, md: 0 },
          flexDirection: { xs: "column", md: "row" },
          width: "100%",
        }}
      >
        <Box
          sx={{
            width: { xs: "100%", md: "50%" },
            height: { xs: "15rem", md: "auto" },
            mb: { xs: 5, md: 0 },
            backgroundImage: 'url("images/LandingPage_Pics/abbcc0c9-b382-442d-b484-212d2e354c3f.jpg")',
            backgroundPosition: { xs: "center", md: "center" },
            backgroundSize: "auto 100%",
            backgroundRepeat: "no-repeat",
            borderRadius: "16px", // Adjust this value for more/less rounding
            overflow: "hidden", // Ensures the image respects the border radius
            position: "relative",
            '&::before': {
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.3) 100%)",
              borderRadius: "16px", // Same as container
            },
            // Optional: Add a subtle shadow for depth
            boxShadow: "0 4px 20px 0 rgba(0,0,0,0.12)",
                
          }}
          data-aos="fade-in"
          data-aos-delay="400"
        />
        <Box
          sx={{
            width: { xs: "100%", md: "50%" },
          }}
        >
          <List
            sx={{
              px: { xs: 0, md: 11 },
              py: { xs: 0, md: 6 },
            }}
          >
            <ListItem>
              <ListItemText
                primary={
                  <Typography
                    variant="h5"
                    component="h3"
                    sx={listItemHeaderStyles}
                  >
                    Flexible Shifts
                  </Typography>
                }
                secondary={
                  <Typography component="p" variant="subtitle1" sx={listItemSubHeaderStyle}>
                    Real-time updates & mobile notifications.
                  </Typography>
                }
                data-aos="fade-left"
                data-aos-delay="600"
              />
            </ListItem>
            <ListItem sx={{ mt: { xs: 1, md: 4 } }}>
              <ListItemText
                primary={
                  <Typography
                    variant="h5"
                    component="h3"
                    sx={listItemHeaderStyles}
                  >
                    Verified Staff
                  </Typography>
                }
                secondary={
                  <Typography component="p" variant="subtitle1" sx={listItemSubHeaderStyle}>
                    ID, referee, and badge-based verification.
                  </Typography>
                }
                data-aos="fade-left"
                data-aos-delay="900"
              />
            </ListItem>
            <ListItem sx={{ mt: { xs: 1, md: 4 } }}>
              <ListItemText
                primary={
                  <Typography
                    variant="h5"
                    component="h3"
                    sx={listItemHeaderStyles}
                  >
                    Easy Shift Management
                  </Typography>
                }
                secondary={
                  <Typography component="p" variant="subtitle1" sx={listItemSubHeaderStyle}>
                    Post jobs, track applications, review history.
                  </Typography>
                }
                data-aos="fade-left"
                data-aos-delay="1200"
              />
            </ListItem>
          </List>
        </Box>
      </Stack>
    </Container>
  );
});

export default Section2;
