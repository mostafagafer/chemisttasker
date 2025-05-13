import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2', // Customize color
    },
    secondary: {
      main: '#9c27b0',
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial',
  },
});

export default theme;
