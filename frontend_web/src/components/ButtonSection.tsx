import { useState } from "react";

// material ui
import { Stack } from "@mui/material";

//components
import Button from "./Button";
import Modal from "./Modal";

function ButtonSection() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState("iOS");
  const handleClose = () => {
    setOpen(false);
  };
  const handleClick = (platform: string) => {
    setPlatform(platform);
    setOpen(true);
  };
  return (
    <>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={3}
        mt={7}
        width={{ xs: "100%", md: "auto" }}
        alignItems="center"
        justifyContent="center"
      >
        <Button
          text="Hire Staff"
          color="strongCyan"
          onClick={() => {
            handleClick("iOS");
          }}
          data-aos="fade-right"
          data-aos-duration="2000"
          data-aos-delay="800"
          data-aos-anchor-placement="top-bottom"
        />
        <Button
          text="Find Shifts"
          color="lightBlue"
          onClick={() => {
            handleClick("Mac");
          }}
          data-aos="fade-left"
          data-aos-duration="2000"
          data-aos-delay="800"
          data-aos-anchor-placement="top-bottom"
        />
      </Stack>
      <Modal open={open} platform={platform} onClose={handleClose} transitionDuration={700}/>
    </>
  );
}

export default ButtonSection;
