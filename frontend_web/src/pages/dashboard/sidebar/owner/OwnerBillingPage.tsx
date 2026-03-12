import { useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    Stack,
    Button,
    TextField,
    Card,
    CardContent,
    Divider,
    CircularProgress,
    Radio,
    RadioGroup,
    FormControlLabel,
    FormControl,
    FormLabel,
    Grid,
    styled
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { createSubscriptionCheckout } from '@chemisttasker/shared-core';
import { useToast } from '../../../../contexts/ToastContext';
import TopBar from './TopBar';

const PricingCard = styled(Card)(() => ({
    borderRadius: '1.5rem',
    border: '1px solid #e2e8f0',
    transition: 'all 0.3s ease',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
    height: '100%',
    position: 'relative',
    overflow: 'visible',
    '&:hover': {
        transform: 'translateY(-10px)',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
    },
}));

export default function OwnerBillingPage({ onBack, totalPharmacies }: { onBack: () => void; totalPharmacies: number }) {
    console.log(`Managing subscription for ${totalPharmacies} pharmacies.`);
    const { showToast } = useToast();

    const [view, setView] = useState<'plans' | 'subscribe'>('plans');
    const [staffCount, setStaffCount] = useState<number>(5);
    const [paymentMethod, setPaymentMethod] = useState<'card' | 'invoice'>('card');
    const [loading, setLoading] = useState(false);

    const handleSubscribe = async () => {
        if (staffCount < 5) {
            showToast('Minimum staff count is 5.', 'warning');
            return;
        }

        setLoading(true);
        try {
            const res: any = await createSubscriptionCheckout({
                staffCount,
                paymentMethod
            });

            if (res.url) {
                window.location.href = res.url;
            } else if (res.message) {
                showToast(res.message, 'success');
                onBack();
            } else {
                showToast('Unexpected response from server.', 'error');
            }
        } catch (err: any) {
            console.error(err);
            showToast(err?.message || 'Failed to initialize subscription.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const calculateTotal = () => {
        const basePrice = 30; // 5 staff members
        const extraStaff = Math.max(0, staffCount - 5);
        const extraPrice = extraStaff * 5;
        return basePrice + extraPrice;
    };

    if (view === 'plans') {
        return (
            <Box sx={{ flex: 1, minWidth: 0, p: { xs: 2, md: 4 } }}>
                <TopBar onBack={onBack} breadcrumb={["Billing & Subscription"]} />

                <Box sx={{ maxWidth: 1000, mx: 'auto', mt: 4 }}>
                    <Typography variant="h4" fontWeight={800} gutterBottom textAlign="center">
                        Choose Your Plan
                    </Typography>
                    <Typography variant="body1" color="text.secondary" paragraph textAlign="center" sx={{ mb: 6 }}>
                        Select the plan that best fits your pharmacy's needs.
                    </Typography>

                    <Grid container spacing={4} justifyContent="center" alignItems="stretch">
                        {/* Pay As You Go */}
                        <Grid size={{ xs: 12, md: 5 }}>
                            <PricingCard>
                                <CardContent sx={{ p: { xs: 4, md: 5 } }}>
                                    <Typography variant="h4" color="text.primary" gutterBottom>
                                        Pay As You Go
                                    </Typography>
                                    <Typography variant="body1" color="text.secondary" sx={{ mb: 4, minHeight: '48px' }}>
                                        For occasional shift coverage. Only pay when a shift is successfully filled.
                                    </Typography>

                                    <Typography variant="h3" sx={{ mb: 1 }}>
                                        $0 <Typography component="span" variant="h6" color="text.secondary">/ month</Typography>
                                    </Typography>

                                    <Box sx={{ mt: 4, mb: 4 }}>
                                        <Divider sx={{ mb: 3 }} />
                                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                                            Shift Fulfillment Fees:
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            <CheckCircleIcon sx={{ color: 'primary.main', mr: 2 }} />
                                            <Typography><strong>$30</strong> per Locum Shift</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            <CheckCircleIcon sx={{ color: 'primary.main', mr: 2 }} />
                                            <Typography><strong>$80</strong> per Part/Full Time Job</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            <CheckCircleIcon sx={{ color: 'primary.main', mr: 2 }} />
                                            <Typography color="text.secondary">No fee if shift goes unfilled</Typography>
                                        </Box>
                                    </Box>

                                    <Button
                                        variant="outlined"
                                        color="primary"
                                        fullWidth
                                        disabled
                                        sx={{ py: 1.5, borderRadius: 2, fontWeight: 'bold' }}
                                    >
                                        Current Plan
                                    </Button>
                                </CardContent>
                            </PricingCard>
                        </Grid>

                        {/* Owner Subscription */}
                        <Grid size={{ xs: 12, md: 5 }}>
                            <PricingCard sx={{ border: '2px solid #00a99d' }}>
                                <Box sx={{
                                    position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
                                    bgcolor: 'primary.main', color: 'white', px: 3, py: 0.5, borderRadius: '20px',
                                    fontWeight: 'bold', fontSize: '0.875rem', letterSpacing: '0.05em', zIndex: 1
                                }}>
                                    RECOMMENDED
                                </Box>

                                <CardContent sx={{ p: { xs: 4, md: 5 } }}>
                                    <Typography variant="h4" color="primary.main" gutterBottom>
                                        Owner Subscription
                                    </Typography>
                                    <Typography variant="body1" color="text.secondary" sx={{ mb: 4, minHeight: '48px' }}>
                                        Best for active pharmacies. Get 50% off all your shift fulfillment fees.
                                    </Typography>

                                    <Typography variant="h3" sx={{ mb: 1 }}>
                                        $30 <Typography component="span" variant="h6" color="text.secondary">/ month</Typography>
                                    </Typography>

                                    <Box sx={{ mt: 4, mb: 4 }}>
                                        <Divider sx={{ mb: 3 }} />
                                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                                            Includes:
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            <CheckCircleIcon sx={{ color: 'primary.main', mr: 2 }} />
                                            <Typography>Connect up to <strong>5 internal staff</strong> per Pharmacy</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            <CheckCircleIcon sx={{ color: 'primary.main', mr: 2 }} />
                                            <Typography><strong>$5</strong> per additional staff member</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            <CheckCircleIcon sx={{ color: 'secondary.main', mr: 2 }} />
                                            <Typography fontWeight="bold">50% off public shift fees</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            <Typography sx={{ ml: 5, color: 'text.secondary', fontSize: '0.9rem' }}>
                                                ($15 Locum / $40 Part/Full time)
                                            </Typography>
                                        </Box>
                                    </Box>

                                    <Button
                                        variant="contained"
                                        color="primary"
                                        fullWidth
                                        onClick={() => setView('subscribe')}
                                        sx={{ py: 1.5, borderRadius: 2, fontWeight: 'bold' }}
                                    >
                                        Subscribe & Save
                                    </Button>
                                </CardContent>
                            </PricingCard>
                        </Grid>
                    </Grid>
                </Box>
            </Box>
        );
    }

    // Subscribe View Form
    return (
        <Box sx={{ flex: 1, minWidth: 0, p: { xs: 2, md: 4 } }}>
            <TopBar onBack={() => setView('plans')} breadcrumb={["Billing & Subscription", "Setup"]} />

            <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
                <Typography variant="h4" fontWeight={800} gutterBottom>
                    Setup Subscription
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                    Your subscription gives you access to full featured tools and locum booking for all your pharmacies.
                </Typography>

                <Card sx={{ mt: 4, borderRadius: 3, boxShadow: 3 }}>
                    <CardContent sx={{ p: 4 }}>
                        <Typography variant="h6" fontWeight={700} gutterBottom>
                            Plan Details
                        </Typography>
                        <Divider sx={{ mb: 3 }} />

                        <Stack spacing={4}>
                            <Box>
                                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                    Number of Staff Members
                                </Typography>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                    Base plan includes up to 5 staff members for $30/month. Additional staff are $5/month each.
                                </Typography>
                                <TextField
                                    type="number"
                                    size="small"
                                    value={staffCount}
                                    onChange={(e) => setStaffCount(parseInt(e.target.value) || 0)}
                                    inputProps={{ min: 5 }}
                                    sx={{ width: 150, mt: 1 }}
                                />
                            </Box>

                            <Box>
                                <FormControl component="fieldset">
                                    <FormLabel component="legend" sx={{ fontWeight: 600, color: 'text.primary', mb: 1 }}>
                                        Payment Method
                                    </FormLabel>
                                    <RadioGroup
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value as 'card' | 'invoice')}
                                    >
                                        <FormControlLabel
                                            value="card"
                                            control={<Radio />}
                                            label={
                                                <Box>
                                                    <Typography fontWeight={500}>Credit/Debit Card</Typography>
                                                    <Typography variant="caption" color="text.secondary">Instant activation via Stripe secure checkout</Typography>
                                                </Box>
                                            }
                                            sx={{ mb: 1 }}
                                        />
                                        <FormControlLabel
                                            value="invoice"
                                            control={<Radio />}
                                            label={
                                                <Box>
                                                    <Typography fontWeight={500}>Invoice</Typography>
                                                    <Typography variant="caption" color="text.secondary">We will email you an invoice with 7-day payment terms</Typography>
                                                </Box>
                                            }
                                        />
                                    </RadioGroup>
                                </FormControl>
                            </Box>

                            <Paper sx={{ p: 3, bgcolor: 'background.default', borderRadius: 2 }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Typography variant="h6" fontWeight={600}>Total / Month:</Typography>
                                    <Typography variant="h5" fontWeight={800} color="primary">${calculateTotal()} AUD</Typography>
                                </Stack>
                            </Paper>

                            <Button
                                variant="contained"
                                color="primary"
                                size="large"
                                fullWidth
                                disabled={loading || staffCount < 5}
                                onClick={handleSubscribe}
                                sx={{ py: 1.5, fontSize: '1.1rem', fontWeight: 700 }}
                            >
                                {loading ? <CircularProgress size={28} color="inherit" /> : `Subscribe with ${paymentMethod === 'card' ? 'Card' : 'Invoice'}`}
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>
            </Box>
        </Box>
    );
}
