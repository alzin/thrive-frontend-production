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
    const booking = await calendarService.createBooking(sessionId);
    return booking;
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
        state.sessions = action.payload.sessions;
      })
      .addCase(fetchCalendarSessions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch sessions';
      })
      // Fetch bookings
      .addCase(fetchUserBookings.fulfilled, (state, action) => {
        state.bookings = action.payload;
      })
      // Create booking
      .addCase(createBooking.fulfilled, (state, action) => {
        state.bookings.push(action.payload);
        // Update session participant count
        const sessionIndex = state.sessions.findIndex(s => s.id === action.payload.sessionId);
        if (sessionIndex !== -1) {
          state.sessions[sessionIndex].currentParticipants++;
          state.sessions[sessionIndex].isBooked = true;
        }
      })
      // Cancel booking
      .addCase(cancelBooking.fulfilled, (state, action) => {
        state.bookings = state.bookings.filter(b => b.id !== action.payload);
        // Update session participant count
        const booking = state.bookings.find(b => b.id === action.payload);
        if (booking) {
          const sessionIndex = state.sessions.findIndex(s => s.id === booking.sessionId);
          if (sessionIndex !== -1) {
            state.sessions[sessionIndex].currentParticipants--;
            state.sessions[sessionIndex].isBooked = false;
          }
        }
      });
  },
});

export const { setSelectedDate, clearError } = calendarSlice.actions;
export default calendarSlice.reducer;