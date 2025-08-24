import React from 'react';
import {
  Dialog,
  DialogContent,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { RegistrationFlow } from '../registration/RegistrationFlow';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ open, onClose }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [currentStep, setCurrentStep] = React.useState(0);

  const handleClose = () => {
    // Prevent closing if on step 2 (Create Account)
    if (currentStep !== 2) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          m: 0,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Mobile Header with Close Button */}
      {isMobile && currentStep !== 2 && (
        <IconButton
          onClick={handleClose}
          sx={{
            position: 'absolute',
            right: 1,
            top: 1,
            zIndex: 1300,
            bgcolor: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.95)',
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      )}

      <DialogContent
        sx={{
          p: 0,
          m: 0,
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          flex: 1,
        }}
      >
        <RegistrationFlow onStepChange={setCurrentStep} />
      </DialogContent>
    </Dialog>
  );
};