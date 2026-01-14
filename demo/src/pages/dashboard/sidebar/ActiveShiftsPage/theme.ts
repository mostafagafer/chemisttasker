import { createTheme } from '@mui/material/styles';

// Inject Inter and Outfit fonts
if (typeof document !== 'undefined') {
    const fontStyle = document.createElement('style');
    fontStyle.innerHTML = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700&display=swap');
    `;
    document.head.appendChild(fontStyle);
}

const PRIMARY_MAIN = '#6366F1'; // Indigo
const PRIMARY_GRADIENT = 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)';
const SECONDARY_MAIN = '#10B981'; // Emerald

export const customTheme = createTheme({
    palette: {
        primary: { main: PRIMARY_MAIN, light: '#818CF8', dark: '#4F46E5' },
        secondary: { main: SECONDARY_MAIN, light: '#34D399', dark: '#059669' },
        success: { main: '#10B981', light: '#D1FAE5', dark: '#047857' },
        error: { main: '#EF4444', light: '#FEE2E2', dark: '#B91C1C' },
        warning: { main: '#F59E0B', light: '#FEF3C7', dark: '#B45309' },
        info: { main: '#3B82F6', light: '#DBEAFE', dark: '#1D4ED8' },
        background: { default: '#F3F4F6', paper: '#FFFFFF' },
        text: { primary: '#111827', secondary: '#6B7280' },
    },
    typography: {
        fontFamily: "'Inter', sans-serif",
        h4: { fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '-0.02em' },
        h6: { fontFamily: "'Outfit', sans-serif", fontWeight: 600, letterSpacing: '-0.01em' },
        button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: '10px',
                    boxShadow: 'none',
                    padding: '8px 16px',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' },
                    '&:active': { transform: 'translateY(0)' },
                },
                containedPrimary: {
                    background: PRIMARY_GRADIENT,
                    color: 'white',
                    '&:hover': {
                        background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                        boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3)',
                    },
                },
                containedSecondary: {
                    background: SECONDARY_MAIN,
                    color: 'white',
                    '&:hover': {
                        background: '#059669',
                        boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)',
                    },
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: '16px',
                    border: '1px solid rgba(229, 231, 235, 0.5)',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                    backgroundImage: 'none',
                    backdropFilter: 'blur(20px)',
                    transition: 'box-shadow 0.2s ease-in-out',
                    '&:hover': {
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    }
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: { fontWeight: 500, borderRadius: '8px' },
                filled: { border: '1px solid transparent' },
                outlined: { borderColor: '#E5E7EB', backgroundColor: 'transparent' },
                sizeSmall: { height: '24px', fontSize: '0.75rem' },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: { backgroundImage: 'none' }
            }
        }
    },
});
