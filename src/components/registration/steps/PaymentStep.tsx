// frontend/src/components/registration/steps/PaymentStep.tsx
import React from 'react';
import { Box, Button, Stack } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { PaymentForm } from '../../payment/PaymentForm';

interface PaymentStepProps {
    email: string;
    onNext: (data: { paymentIntentId: string }) => void;
    onBack: () => void;
}

export const PaymentStep: React.FC<PaymentStepProps> = ({ email, onNext, onBack }) => {
    const handlePaymentSuccess = (paymentIntentId: string) => {
        onNext({ paymentIntentId });
    };

    return (
        <Box>
            <Stack spacing={3}>
                <Button
                    startIcon={<ArrowBack />}
                    onClick={onBack}
                    sx={{ alignSelf: 'flex-start' }}
                >
                    Back to Email
                </Button>

                <PaymentForm
                    email={email}
                    onSuccess={handlePaymentSuccess}
                    showEmailField={false}
                />
            </Stack>
        </Box>
    );
};