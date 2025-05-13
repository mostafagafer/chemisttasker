//material ui
import {
  // Box,
  Button,
  Typography,
  TypographyProps,
  Stack,
  Container,
  Link,
  LinkProps,
} from "@mui/material";
import { styled } from "@mui/material/styles";

// icons
import { Twitter, Facebook, Instagram } from "@mui/icons-material";

// styles
import {
  footerWrapperStyles,
  footerContainerStyles,
  footerLinkContainerStyles,
  footerButtonStyles,
} from "../styles/footer";

// trying different ways of customizing Material UI components:

// customizing Typography using styled() utility
const FooterTypography = styled(Typography)<TypographyProps>(({ theme }) => ({
  fontSize: 18,
  fontWeight: 600,
  [theme.breakpoints.up("xs")]: {
    textAlign: "center",
  },
  [theme.breakpoints.up("md")]: {
    textAlign: "left",
  },
}));

// customizing Typography using wrapper component
// const FooterTypography2 = (props: TypographyProps) => (
//   <Typography
//     fontSize={18}
//     fontWeight={600}
//     sx={{ textAlign: { xs: "center", md: "left" } }}
//     {...props}
//   >
//     {props.children}
//   </Typography>
// );

// customizing Link using both wrapper and styled() methods
const FooterLink = (props: LinkProps) => {
  const CustomLink = styled(Link)<LinkProps>(({ theme }) => ({
    color: "inherit",
    transition: theme.transitions.create(["color"], {
      duration: theme.transitions.duration.standard,
    }),
    "&:hover": {
      color: theme.palette.strongCyan.main,
    },
  }));
  return (
    <CustomLink {...props} underline="none" rel="noopener">
      {props.children}
    </CustomLink>
  );
};

const Footer = () => {
  //scrolls to the top
  const scrollToTop = () => {
    document.getElementById("section-container")?.scrollTo(0, 0);
  };

  return (
    <Stack
      sx={footerWrapperStyles}
      data-aos="fade-up"
      data-aos-delay="800"
    >
<Container sx={footerContainerStyles}>
  <Button
    onClick={() => scrollToTop()}
    title="Back to top"
    aria-label="Back to top"
    sx={footerButtonStyles}
  >
    <img
      src="images/logo.svg"
      alt="Clipboard Logo"
      width="56"
      aria-hidden="true"
    />
  </Button>
  
  <Stack 
    direction="row" 
    justifyContent="center"
    spacing={{ xs: 3, md: 6 }}
    sx={footerLinkContainerStyles}
  >
    <FooterTypography>
      <FooterLink href="#0">FAQs</FooterLink>
    </FooterTypography>
    
    <FooterTypography>
      <FooterLink href="#0">Privacy Policy</FooterLink>
    </FooterTypography>
    
    <FooterTypography>
      <FooterLink href="#0">Contact Us</FooterLink>
    </FooterTypography>
  </Stack>
  
  <Stack
    direction="row"
    spacing={3}
    sx={{ fontSize: 28, lineHeight: 0.7 }}
  >
    <FooterLink href="#0" aria-label="Facebook">
      <Facebook fontSize="inherit" />
    </FooterLink>
    <FooterLink href="#0" aria-label="Twitter">
      <Twitter fontSize="inherit" />
    </FooterLink>
    <FooterLink href="#0" aria-label="Instagram">
      <Instagram fontSize="inherit" />
    </FooterLink>
  </Stack>
</Container>
    </Stack>
  );
};

export default Footer;
