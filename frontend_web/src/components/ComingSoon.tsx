import { Box, Typography, Paper, useTheme } from "@mui/material";
import { motion } from "framer-motion";

interface ComingSoonProps {
  logoUrl?: string;
}

const ComingSoon: React.FC<ComingSoonProps> = ({ logoUrl }) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f9f8fd",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Paper
        elevation={6}
        sx={{
          maxWidth: 480,
          p: { xs: 3, md: 6 },
          borderRadius: 6,
          textAlign: "center",
          background: "#fff",
          boxShadow: "0 6px 36px #ececec",
        }}
        component={motion.div}
        initial={{ opacity: 0, scale: 0.94, y: 32 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
      >
        <motion.img
          src={logoUrl || "/logo.png"}
          alt="ChemistTaskerRx Logo"
            style={{
                marginBottom: theme.spacing(4),
                objectFit: "contain",
                objectPosition: "center",
                width: "100%",
                maxWidth: 320,
                height: "auto",
                display: "block",
                marginLeft: "auto",
                marginRight: "auto",
            }}
          initial={{ y: 0 }}
          animate={{
            y: [0, -10, 0, 10, 0],
          }}
          transition={{
            duration: 3.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{
            fontWeight: 800,
            color: "#1a2c45",
            letterSpacing: "1px",
          }}
        >
          Coming Soon!
        </Typography>
        <Typography
          variant="h6"
          sx={{
            color: "#23b59c",
            fontWeight: 500,
            mb: 2,
          }}
        >
          ChemistTaskerRx
        </Typography>
        <Typography sx={{ color: "#586882", mb: 2 }}>
          The all-in-one platform for pharmacy workforce, shift management, and real-time collaboration.
        </Typography>
        <Typography
          sx={{
            color: "#199982",
            mb: 3,
            fontWeight: 500,
          }}
        >
          Built for Australian pharmacies and healthcare professionals.
        </Typography>
        <motion.div
          initial={{ opacity: 0.5 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.7, repeat: Infinity }}
        >
          <Typography
            variant="subtitle1"
            sx={{
              color: "#23b59c",
              fontWeight: 500,
              letterSpacing: "0.05em",
            }}
          >
            Stay tuned—launching soon!
          </Typography>
        </motion.div>
      </Paper>
    </Box>
  );
};

export default ComingSoon;
