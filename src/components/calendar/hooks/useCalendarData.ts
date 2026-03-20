import { useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  calendarService,
  BookingLimits,
} from "../../../services/calendarService";
import { AppDispatch, RootState } from "../../../store/store";
import {
  fetchCalendarSessions,
  fetchUserBookings,
} from "../../../store/slices/calendarSlice";

export const useCalendarData = (selectedDate: Date) => {
  const dispatch = useDispatch<AppDispatch>();
  const { sessions, bookings: myBookings, loading } = useSelector(
    (state: RootState) => state.calendar,
  );

  const [bookingLimits, setBookingLimits] = useState<BookingLimits | null>(null);
  const [limitsLoading, setLimitsLoading] = useState(true);

  const fetchCalendarData = useCallback(async () => {
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1;

      await Promise.all([
        dispatch(fetchCalendarSessions({ year, month })).unwrap(),
        dispatch(fetchUserBookings()).unwrap(),
      ]);
    } catch (error) {
      console.error("Failed to fetch calendar data:", error);
      throw error;
    }
  }, [dispatch, selectedDate]);

  const fetchBookingLimits = async () => {
    try {
      setLimitsLoading(true);
      const limits = await calendarService.getBookingLimits();
      setBookingLimits(limits);
    } catch (error) {
      console.error("Failed to fetch booking limits:", error);
      // Don't throw - limits are not critical for basic functionality
      setBookingLimits(null);
    } finally {
      setLimitsLoading(false);
    }
  };

  const refetch = async () => {
    await Promise.all([
      fetchCalendarData(),
      fetchBookingLimits()
    ]);
  };

  useEffect(() => {
    fetchCalendarData();
    fetchBookingLimits();
  }, [fetchCalendarData]);

  return {
    sessions,
    myBookings,
    bookingLimits,
    loading,
    limitsLoading,
    refetch,
  };
};
