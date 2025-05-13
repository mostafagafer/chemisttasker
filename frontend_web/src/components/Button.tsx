import {
  alpha,
  darken,
  lighten,
  SxProps,
  Theme,
  Palette,
  PaletteColor,
} from "@mui/material/styles";
import { Button as MaterialButton,ButtonProps } from "@mui/material";

//interfaces
interface IButtonProps extends Omit<ButtonProps,'color'> {
  text: string;
  color: keyof Palette;
}
const test: SxProps = {
  //    borderBottom
};

function Button( {text,color,...props}: IButtonProps) {
  //   const theme = useTheme();
  // styles

  const buttonStyles = (theme: Theme) => {
    const themeColor = (theme.palette[color] as PaletteColor).main;
    return {
      width:{xs:"84%",sm:'24rem',md:"auto"},
      backgroundColor: themeColor,
      color: "white",
      borderRadius: "2rem",
      py: 1.5,
      px: 5,
      fontWeight: 600,
      textTransform: "none",
      fontSize: 18,
      borderBottom: "0.2rem solid " + darken(themeColor, 0.15),
      textShadow: "0 0 2px " + darken(themeColor, 0.5),
      boxShadow: "0 0.25rem 1rem " + alpha(darken(themeColor, 0.5), 0.4),
      "&:hover": {
        backgroundColor: lighten(themeColor, 0.15),
        textShadow: "0 0 5px " + darken(themeColor, 0.5),
        boxShadow: "0 0.25rem 1rem " + alpha(darken(themeColor, 0.5), 0.6),
        transform: "scale(102%)",
      },
    };
  };
  return (
    <MaterialButton sx={buttonStyles} {...props} >
      {text}
    </MaterialButton>
  );
}

export default Button;
