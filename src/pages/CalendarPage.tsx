import React, { useState } from "react";
import {
  Container,
  Grid,
  Snackbar,
  Alert,
  Paper,
  Typography,
  Button,
  Stack,
  Chip,
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../store/store";
import { useSweetAlert } from "../utils/sweetAlert";
import { subscriptionService } from "../services/subscriptionService";
import { checkPayment } from "../store/slices/authSlice";
import { cancelBooking, fetchUserBookings } from "../store/slices/calendarSlice";
import { sleep } from "../utils/sleep";
import { useNavigate } from "react-router-dom";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import {
  CalendarHeader,
  CalendarGrid,
  MyBookings,
  PointsBalance,
  BookingDialog,
  AttendeesDialog,
  useCalendarData,
  useBookingDialog,
  useAttendeesDialog,
} from "../components/calendar";

export const CalendarPage: React.FC = () => {
  const JAPAN_TIME_ZONE = "Asia/Tokyo";
  const { showConfirm, showError } = useSweetAlert();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loadingStart, setLoadingStart] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [alternativeTimeDraft, setAlternativeTimeDraft] = useState<Date | null>(
    null,
  );
  const [preferredTimes, setPreferredTimes] = useState<string[]>([]);
  const [submittingAlternativeTime, setSubmittingAlternativeTime] =
    useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "warning" | "info",
  });

  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const profile = useSelector((state: RootState) => state.dashboard.data);
  const {
    user,
    status,
    hasAccessToCourses,
    isTrialing,
    trialBookingRequirementCompleted,
  } = useSelector(
    (state: RootState) => state.auth,
  );

  const formatTimeInUserZone = (isoTime: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: JAPAN_TIME_ZONE,
      weekday: "short",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(isoTime));

  const toJapanIsoFromPickerDate = (draft: Date): string => {
    const year = draft.getFullYear();
    const month = draft.getMonth();
    const day = draft.getDate();
    const hour = draft.getHours();
    const minute = draft.getMinutes();

    // Treat picker values as JST (UTC+9) and convert to a canonical UTC ISO string.
    const utcMillis = Date.UTC(year, month, day, hour - 9, minute, 0, 0);
    return new Date(utcMillis).toISOString();
  };

  // Custom hooks - now includes bookingLimits
  const { sessions, myBookings, bookingLimits, loading, refetch } =
    useCalendarData(selectedDate);
  const {
    bookingDialog,
    setBookingDialog,
    eligibility,
    bookLoading,
    handleBookSession,
  } = useBookingDialog();
  const { attendeesDialog, setAttendeesDialog, attendees, fetchAttendees } =
    useAttendeesDialog();

  const showSnackbar = (
    message: string,
    severity: "success" | "error" | "warning" | "info",
  ) => {
    setSnackbar({ open: true, message, severity });
  };

  const handleBookSessionClick = async () => {
    try {
      await handleBookSession(() => {
        showSnackbar("Session booked successfully!", "success");
        refetch();
      });
      await dispatch(checkPayment());
    } catch (error: any) {
      setBookingDialog(null);
      // Show detailed error message if available from API
      const errorMessage =
        error?.response?.data?.error?.message || "Failed to book session";
      showError("Booking Failed", errorMessage);
    }
  };

  const handleSubscription = async () => {
    setLoadingStart(true);
    try {
      await subscriptionService.endTrial();
      await sleep(5000);
      await dispatch(checkPayment());
      showSnackbar("Starting Subscription successfully!", "success");
    } catch (error) {
      // Error handled by snackbar
    } finally {
      setLoadingStart(false);
    }
  };

  const handleCancelBooking = async (booking: any) => {
    const result = await showConfirm({
      title: "Cancel Booking",
      text: "Are you sure you want to cancel this booking?",
      icon: "warning",
      confirmButtonText: "Yes, cancel it",
      cancelButtonText: "Keep booking",
    });

    if (result.isConfirmed) {
      try {
        await dispatch(cancelBooking(booking.id)).unwrap();
        await dispatch(fetchUserBookings()).unwrap();
        await dispatch(checkPayment());
        showSnackbar("Booking cancelled successfully!", "success");
        refetch();
      } catch (error) {
        showError("Error", "Failed to cancel booking");
      }
    }
  };

  const handleFetchAttendees = async (session: any) => {
    try {
      await fetchAttendees(session);
    } catch (error) {
      showSnackbar("Failed to fetch attendees", "error");
    }
  };

  const copyMeetingLink = (url: string) => {
    navigator.clipboard.writeText(url);
    showSnackbar("Meeting link copied to clipboard", "success");
  };

  const handleSubmitAlternativeTimes = async () => {
    if (preferredTimes.length < 3) {
      showSnackbar("Please add at least 3 preferred times.", "warning");
      return;
    }

    try {
      setSubmittingAlternativeTime(true);
      await subscriptionService.submitTrialAlternativeTimeRequest(
        preferredTimes,
        JAPAN_TIME_ZONE,
      );
      await dispatch(checkPayment());
      showSnackbar(
        "Thanks! We received your preferred times and unlocked your platform access.",
        "success",
      );
      setPreferredTimes([]);
      setAlternativeTimeDraft(null);
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.error ||
        "Failed to submit your preferred times. Please try again.";
      showSnackbar(errorMessage, "error");
    } finally {
      setSubmittingAlternativeTime(false);
    }
  };

  const handleAddAlternativeTime = () => {
    if (!alternativeTimeDraft) {
      showSnackbar("Please choose a date and time first.", "warning");
      return;
    }

    if (preferredTimes.length >= 5) {
      showSnackbar("You can add up to 5 preferred times.", "info");
      return;
    }

    const selectedIso = toJapanIsoFromPickerDate(alternativeTimeDraft);
    const selectedTime = new Date(selectedIso).getTime();
    if (selectedTime <= Date.now()) {
      showSnackbar("Please select a future date and time.", "warning");
      return;
    }

    if (preferredTimes.includes(selectedIso)) {
      showSnackbar("This time is already added.", "info");
      return;
    }

    setPreferredTimes((prev) => [...prev, selectedIso].sort());
    setAlternativeTimeDraft(null);
  };

  const handleRemoveAlternativeTime = (timeIso: string) => {
    setPreferredTimes((prev) => prev.filter((time) => time !== timeIso));
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {isTrialing && !trialBookingRequirementCompleted && (
        <Paper sx={{ p: { xs: 2, md: 2.5 }, mb: 3, border: "1px solid", borderColor: "warning.light" }}>
          <Stack spacing={1.25}>
            <Alert severity="warning">
              This is required to unlock full platform access during your trial.
            </Alert>
            <Typography variant="h6" fontWeight={700}>
              Book your free session from the calendar first
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Choose any suitable session from the calendar below. If nothing fits,
              use the alternative-time form under My Bookings.
            </Typography>
          </Stack>
        </Paper>
      )}

      <CalendarHeader
        onTodayClick={() => setSelectedDate(new Date())}
        onRefresh={refetch}
      />

      <Grid container spacing={4}>
        {/* Calendar */}
        <Grid size={{ xs: 12, md: 8 }}>
          <CalendarGrid
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            sessions={sessions}
            myBookings={myBookings}
            loading={loading}
            onSessionClick={setBookingDialog}
            onAttendeesClick={handleFetchAttendees}
            onCancelBooking={handleCancelBooking}
            onCopyMeetingLink={copyMeetingLink}
            user={{ ...user, status }}
          />
        </Grid>

        {/* Sidebar */}
        <Grid size={{ xs: 12, md: 4 }}>
          <MyBookings
            myBookings={myBookings}
            onCancelBooking={handleCancelBooking}
            bookingLimits={bookingLimits}
          />

          {isTrialing && !trialBookingRequirementCompleted && (
            <Paper sx={{ p: 2, my: 2 }}>
              <Stack spacing={1.5}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Typography variant="h6" fontWeight={700}>
                    Need another time?
                  </Typography>
                  <Chip
                    size="small"
                    color={preferredTimes.length > 0 ? "success" : "default"}
                    label={`${preferredTimes.length}/5`}
                  />
                </Stack>

                <Typography variant="body2" color="text.secondary">
                  If no scheduled session works for you, add your best times and submit. (Required minimum 3 times)
                </Typography>

                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <DateTimePicker
                      label="Preferred date and time"
                      value={alternativeTimeDraft}
                      onChange={setAlternativeTimeDraft}
                      minDateTime={new Date()}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                        },
                      }}
                    />
                    <Button
                      variant="contained"
                      sx={{ height: 50 }}
                      onClick={handleAddAlternativeTime}
                      disabled={!alternativeTimeDraft}
                    >
                      Add
                    </Button>
                  </Stack>
                </LocalizationProvider>

                {preferredTimes.length > 0 ? (
                  <Stack direction="row" gap={1} useFlexGap flexWrap="wrap">
                    {preferredTimes.map((timeIso) => (
                      <Chip
                        key={timeIso}
                        color="primary"
                        variant="outlined"
                        label={formatTimeInUserZone(timeIso)}
                        onDelete={() => handleRemoveAlternativeTime(timeIso)}
                      />
                    ))}
                  </Stack>
                ) : (
                  <Alert severity="info">No alternative times added yet.</Alert>
                )}

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={handleSubmitAlternativeTimes}
                    disabled={submittingAlternativeTime || preferredTimes.length < 3  || Boolean(alternativeTimeDraft)}
                  >
                    {submittingAlternativeTime ? "Submitting..." : "Submit alternative times"}
                  </Button>
                  {preferredTimes.length > 0 && (
                    <Button variant="text" color="inherit" onClick={() => setPreferredTimes([])}>
                      Clear all
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Paper>
          )}

          <PointsBalance totalPoints={profile?.stats.totalPoints || 0} />
        </Grid>
      </Grid>

      {/* Booking Dialog */}
      <BookingDialog
        open={!!bookingDialog}
        onClose={() => setBookingDialog(null)}
        session={bookingDialog}
        eligibility={eligibility}
        loading={bookLoading}
        onBook={handleBookSessionClick}
        onSubscribe={handleSubscription}
        onNavigateToSubscription={() => navigate("/manage-subscription")}
        agreeToTerms={agreeToTerms}
        onAgreeToTermsChange={setAgreeToTerms}
        userStatus={status || "inactive"}
        hasAccessToCourses={hasAccessToCourses}
        loadingStart={loadingStart}
      />

      {/* Attendees Dialog */}
      <AttendeesDialog
        open={!!attendeesDialog}
        onClose={() => setAttendeesDialog(null)}
        session={attendeesDialog}
        attendees={attendees}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};
