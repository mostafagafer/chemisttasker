import React from "react";

// material ui
import {
  Stack,
  Dialog,
  DialogTitle,
  Box,
  Typography,
  Link,
  Tooltip,
  Divider,
  DialogProps,
  TooltipProps,
  LinkProps,
  DividerProps,
  Fade,
  Theme,
  styled,
} from "@mui/material";

// icons
import { LaptopMac, PhoneIphone } from "@mui/icons-material";
import {
  SiX,
  SiLinkedin,
  SiFrontendmentor,
  SiGithub,
  SiGmail,
} from "react-icons/si";
import { FaSuitcase } from "react-icons/fa";

//styles
import { paperStyles, titleStyles, iconContainerStyles } from "../styles/modal";

// custom Tooltip wrapper component
const ModalTooltip = (props: TooltipProps) => (
  <Tooltip
    {...props}
    arrow
    placement="top"
    TransitionComponent={Fade}
    TransitionProps={{ timeout: 500 }}
  >
    {props.children}
  </Tooltip>
);

// custom Link wrapper component
const ModalLink = React.forwardRef<HTMLAnchorElement, LinkProps>(
  (props, ref) => {
    const linkStyles = (theme: Theme) => ({
      transition: theme.transitions.create(["filter", "transform", "border"], {
        duration: theme.transitions.duration.standard,
      }),
      "&:hover": {
        filter: "brightness(150%)",
        transform: "scale(1.2)",
      },
    });
    return (
      <Link {...props} target="_blank" rel="noopener" sx={linkStyles} ref={ref}>
        {props.children}
      </Link>
    );
  }
);

// custom Divider using style()
const ModalDivider = styled(Divider)<DividerProps>(({ theme }) => ({
  [theme.breakpoints.up("xs")]: {
    width: "90%",
  },
  [theme.breakpoints.up("md")]: {
    width: "100%",
  },
}));

//interfaces
interface IModalProps extends DialogProps {
  open: boolean;
  platform: string;
}

function Modal({ open, platform, ...props }: IModalProps) {
  return (
    <Dialog
      onClose={props.onClose}
      open={open}
      PaperProps={{
        sx: paperStyles,
      }}
      scroll="body"
      {...props}
    >
      <Box sx={{ fontSize: { xs: 100, md: 150 }, lineHeight: 0.7 }}>
        {platform === "iOS" ? (
          <PhoneIphone fontSize="inherit" />
        ) : (
          <LaptopMac fontSize="inherit" />
        )}
      </Box>
      <DialogTitle sx={titleStyles}>
        {platform === "iOS" ? "Download for iOS" : "Download for Mac"}
      </DialogTitle>
      <Stack
        direction="column"
        spacing={2}
        alignItems="center"
        sx={(theme: Theme) => ({
          fontSize: { xs: 17, md: 18 },
          color: theme.palette.grayishBlue.main,
          fontWeight: 600,
        })}
      >
        <ModalDivider />
        <Stack alignItems="center">
          <Typography fontSize="inherit" fontWeight="inherit">
            Developed by
          </Typography>
          <Typography mt={{ xs: 0, md: -1 }} sx={titleStyles}>
            Rashid Shamloo
          </Typography>
        </Stack>
        <ModalDivider />
        <Typography fontSize="inherit" fontWeight="inherit">
          Technologies used in this project
        </Typography>
        <Stack
          sx={{
            "& img": { width: { xs: 48, md: 60 } },
          }}
          direction="row"
          spacing={4}
        >
          <ModalTooltip title="React.js">
            <ModalLink href="https://react.dev" target="_blank">
              <img
                src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg"
                alt="React.js"
                aria-hidden="true"
              />
            </ModalLink>
          </ModalTooltip>
          <ModalTooltip title="Material UI">
            <ModalLink href="https://mui.com" target="_blank">
              <img
                src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/materialui/materialui-original.svg"
                alt="Material UI"
                aria-hidden="true"
              />
            </ModalLink>
          </ModalTooltip>
          <ModalTooltip title="TypeScript">
            <ModalLink href="https://www.typescriptlang.org" target="_blank">
              <img
                src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg"
                alt="TypeScript"
                aria-hidden="true"
              />
            </ModalLink>
          </ModalTooltip>
        </Stack>
        <ModalDivider />
        <Typography fontSize="inherit" fontWeight="inherit">
          Project source on GitHub
        </Typography>
        <Link
          href="https://github.com/rashidshamloo/fem_031_clipboard-landing-page"
          sx={{
            "&:hover": { filter: "brightness(95%)" },
            transition: "all 500ms",
          }}
          aria-label="Project Source on GitHub"
        >
          <img
            src="https://gh-card.dev/repos/rashidshamloo/fem_031_clipboard-landing-page.svg"
            style={{ maxWidth: "100%", verticalAlign: "middle" }}
            alt="Project Source on GitHub"
            aria-hidden="true"
          />
        </Link>
        <ModalDivider />
        <Typography fontSize="inherit" fontWeight="inherit">
          Contact Me
        </Typography>
        <Stack sx={iconContainerStyles}>
          <ModalTooltip title="Email">
            <ModalLink href="mailto:rashidshamloo@gmail.com" target="_blank">
              <SiGmail style={{ color: "#EA4335" }} />
            </ModalLink>
          </ModalTooltip>
          <ModalTooltip title="Linkedin">
            <ModalLink
              href="https://www.linkedin.com/in/rashid-shamloo/"
              target="_blank"
            >
              <SiLinkedin style={{ color: "#0A66C2" }} />
            </ModalLink>
          </ModalTooltip>
          <ModalTooltip title="GitHub">
            <ModalLink href="https://github.com/rashidshamloo/" target="_blank">
              <SiGithub style={{ color: "#181717" }} />
            </ModalLink>
          </ModalTooltip>
          <ModalTooltip title="Twitter">
            <ModalLink href="http://twitter.com/rashidshamloo" target="_blank">
              <SiX  style={{ color: "#1DA1F2" }} />
            </ModalLink>
          </ModalTooltip>
          <ModalTooltip title="Frontend Mentor">
            <ModalLink
              href="https://www.frontendmentor.io/profile/rashidshamloo"
              target="_blank"
            >
              <SiFrontendmentor style={{ color: "#3F54A3" }} />
            </ModalLink>
          </ModalTooltip>
          <ModalTooltip title="Portfolio">
            <ModalLink href="https://rashidshamloo.ir" target="_blank">
              <FaSuitcase style={{ color: "#FC6A03" }} />
            </ModalLink>
          </ModalTooltip>
        </Stack>
      </Stack>
    </Dialog>
  );
}

export default Modal;
