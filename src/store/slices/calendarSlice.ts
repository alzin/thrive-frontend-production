import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { calendarService, CalendarSession, Booking } from '../../services/calendarService';

interface CalendarState {
  sessions: CalendarSession[];
  bookings: Booking[];
  selectedDate: string;
  loading: boolean;
  error: string | null;
}

const initialState: CalendarState = {
  sessions: [],
  bookings: [],
  selectedDate: new Date().toISOString(),
  loading: false,
  error: null,
};

export const fetchCalendarSessions = createAsyncThunk(
  'calendar/fetchSessions',
  async ({ year, month }: { year: number; month: number }) => {
    const response = await calendarService.getCalendarSessions(year, month);
    return response;
  }
);

export const fetchUserBookings = createAsyncThunk(
  'calendar/fetchBookings',
  async () => {
    const bookings = await calendarService.getUpcomingBookings();
    return bookings;
  }
);

export const createBooking = createAsyncThunk(
  'calendar/createBooking',
  async (sessionId: string) => {
    const response = await calendarService.createBooking(sessionId);
    return response?.data ?? response;
  }
);

export const cancelBooking = createAsyncThunk(
  'calendar/cancelBooking',
  async (bookingId: string) => {
    await calendarService.cancelBooking(bookingId);
    return bookingId;
  }
);

const calendarSlice = createSlice({
  name: 'calendar',
  initialState,
  reducers: {
    setSelectedDate: (state, action) => {
      state.selectedDate = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch sessions
      .addCase(fetchCalendarSessions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCalendarSessions.fulfilled, (state, action) => {
        state.loading = false;
        const payload = action.payload?.data ?? action.payload;
        state.sessions = payload?.sessions || [];
      })
      .addCase(fetchCalendarSessions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch sessions';
      })
      // Fetch bookings
      .addCase(fetchUserBookings.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchUserBookings.fulfilled, (state, action) => {
        state.bookings = action.payload || [];
      })
      .addCase(fetchUserBookings.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to fetch bookings';
      })
      // Create booking
      .addCase(createBooking.pending, (state) => {
        state.error = null;
      })
      .addCase(createBooking.fulfilled, (state, action) => {
        const booking = action.payload?.data ?? action.payload;
        if (!booking?.id) {
          return;
        }

        state.bookings.push(booking);
        // Update session participant count
        const sessionIndex = state.sessions.findIndex(s => s.id === booking.sessionId);
        if (sessionIndex !== -1) {
          state.sessions[sessionIndex].currentParticipants++;
          state.sessions[sessionIndex].isBooked = true;
        }
      })
      .addCase(createBooking.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to create booking';
      })
      // Cancel booking
      .addCase(cancelBooking.pending, (state) => {
        state.error = null;
      })
      .addCase(cancelBooking.fulfilled, (state, action) => {
        const booking = state.bookings.find(b => b.id === action.payload);
        state.bookings = state.bookings.filter(b => b.id !== action.payload);

        // Update session participant count
        if (booking) {
          const sessionIndex = state.sessions.findIndex(s => s.id === booking.sessionId);
          if (sessionIndex !== -1) {
            state.sessions[sessionIndex].currentParticipants--;
            state.sessions[sessionIndex].isBooked = false;
          }
        }
      })
      .addCase(cancelBooking.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to cancel booking';
      });
  },
});

export const { setSelectedDate, clearError } = calendarSlice.actions;
export default calendarSlice.reducer;