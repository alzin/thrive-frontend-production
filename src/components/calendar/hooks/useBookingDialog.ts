import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { calendarService, CalendarSession, BookingEligibility } from "../../../services/calendarService";
import { AppDispatch } from "../../../store/store";
import { createBooking, fetchUserBookings } from "../../../store/slices/calendarSlice";

export const useBookingDialog = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [bookingDialog, setBookingDialog] = useState<CalendarSession | null>(null);
  const [eligibility, setEligibility] = useState<BookingEligibility | null>(null);
  const [bookLoading, setBookLoading] = useState(false);

  const checkEligibility = async (sessionId: string) => {
    try {
      const data = await calendarService.checkBookingEligibility(sessionId);
      setEligibility(data);
    } catch (error) {
      console.error("Failed to check eligibility:", error);
    }
  };

  useEffect(() => {
    if (bookingDialog) {
      checkEligibility(bookingDialog.id);
    }
  }, [bookingDialog]);

  const handleBookSession = async (onSuccess: () => void) => {
    if (!bookingDialog || !eligibility?.canBook) return;

    try {
      setBookLoading(true);
      await dispatch(createBooking(bookingDialog.id)).unwrap();
      await dispatch(fetchUserBookings()).unwrap();
      onSuccess();
      setBookingDialog(null);
    } catch (error) {
      throw error;
    } finally {
      setBookLoading(false);
    }
  };

  return {
    bookingDialog,
    setBookingDialog,
    eligibility,
    bookLoading,
    handleBookSession,
  };
};
