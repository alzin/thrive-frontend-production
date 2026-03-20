import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Control,
  FieldErrors,
  useFieldArray,
  UseFormClearErrors,
} from "react-hook-form";
import {
  Box,
  Stack,
  Typography,
  Button,
  Paper,
  IconButton,
  TextField,
  Grid,
  Alert,
  Dialog,
  DialogContent,
  DialogActions,
  CircularProgress,
  Tooltip,
  Chip,
} from "@mui/material";
import { useTheme, alpha, keyframes } from "@mui/material/styles";
import {
  DeleteOutline,
  Translate,
  VolumeUp,
  AddCircleOutline,
  CloudUpload,
  Mic,
  Stop,
  FiberManualRecord,
  Headphones,
  CloudUpload as UploadIcon,
} from "@mui/icons-material";
import { Keyword, LessonFormState } from "../../types/lsesson-form.types";
import { KeywordsSummary } from "./KeywordsSummary";
import { AudioWaveformPlayer } from "../common/AudioWaveformPlayer";
import { communityService } from "../../services/communityService";
const MicRecorder = require("mic-recorder-to-mp3");

// ── Animations ──────────────────────────────────────────────────────
const pulse = keyframes`
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.15); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
`;

const ripple = keyframes`
  0% { transform: scale(1); opacity: 0.4; }
  100% { transform: scale(2.2); opacity: 0; }
`;

// ── Recording timer hook ────────────────────────────────────────────
const useRecordingTimer = (isActive: boolean) => {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isActive) {
      setSeconds(0);
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setSeconds(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive]);

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

interface KeywordsFormProps {
  control: Control<LessonFormState>;
  errors: FieldErrors<LessonFormState>;
  clearErrors: UseFormClearErrors<LessonFormState>;
  isMobile: boolean;
  setBulkAudioDialog: React.Dispatch<React.SetStateAction<boolean>>;
}

// Memoized individual keyword item to prevent re-renders of all items when one changes
interface KeywordItemProps {
  index: number;
  keyword: Keyword;
  onUpdate: (index: number, field: keyof Keyword, value: string) => void;
  onRemove: (index: number) => void;
  onClearError: (index: number) => void;
  onRecordAudio: (index: number, field: AudioFieldKey) => void;
  isRecordingField: (index: number, field: AudioFieldKey) => boolean;
  isRecorderBusy: boolean;
  activeRecording: ActiveRecording | null;
}

type AudioFieldKey =
  | "japaneseAudioUrl"
  | "englishAudioUrl"
  | "japaneseSentenceAudioUrl";

interface ActiveRecording {
  index: number;
  field: AudioFieldKey;
}

interface RecordingPreview {
  index: number;
  field: AudioFieldKey;
  blob: Blob;
  previewUrl: string;
}

// ── Audio field card ────────────────────────────────────────────────
interface AudioFieldCardProps {
  index: number;
  field: AudioFieldKey;
  label: string;
  audioUrl: string;
  onUpdate: (index: number, field: keyof Keyword, value: string) => void;
  onClearError: (index: number) => void;
  onRecordAudio: (index: number, field: AudioFieldKey) => void;
  isRecording: boolean;
  isRecorderBusy: boolean;
  isAnyRecording: boolean;
}

const AUDIO_FIELD_LABELS: Record<AudioFieldKey, string> = {
  japaneseAudioUrl: "🇯🇵 Japanese Word",
  englishAudioUrl: "🇬🇧 English Word",
  japaneseSentenceAudioUrl: "🇯🇵 Japanese Sentence",
};

const AudioFieldCard = memo<AudioFieldCardProps>(
  ({
    index,
    field,
    label,
    audioUrl,
    onUpdate,
    onClearError,
    onRecordAudio,
    isRecording,
    isRecorderBusy,
    isAnyRecording,
  }) => {
    const theme = useTheme();
    const elapsed = useRecordingTimer(isRecording);

    return (
      <Box
        sx={{
          p: 1.5,
          borderRadius: 3,
          border: `1px solid ${isRecording ? alpha(theme.palette.error.main, 0.4) : alpha(theme.palette.divider, 0.6)}`,
          bgcolor: isRecording
            ? alpha(theme.palette.error.main, 0.03)
            : "transparent",
          transition: "all 0.3s ease",
        }}
      >
        <Typography
          variant="caption"
          fontWeight={600}
          color="text.secondary"
          sx={{ mb: 1, display: "block", letterSpacing: 0.3 }}
        >
          {label}
        </Typography>

        {/* URL input */}
        <TextField
          fullWidth
          size="small"
          placeholder="https://s3.../audio.mp3"
          defaultValue={audioUrl}
          onChange={() => onClearError(index)}
          onBlur={(e) => onUpdate(index, field, e.target.value)}
          InputProps={{
            startAdornment: (
              <VolumeUp
                sx={{ mr: 0.5, color: "action.active", fontSize: 18 }}
              />
            ),
          }}
          sx={{ mb: 1 }}
        />

        {/* Inline waveform if URL exists */}
        {audioUrl && !isRecording && (
          <Box sx={{ mb: 1 }}>
            <AudioWaveformPlayer src={audioUrl} compact />
          </Box>
        )}

        {/* Recording state indicator */}
        {isRecording && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: 1,
              px: 1.5,
              py: 0.75,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.error.main, 0.08),
            }}
          >
            <FiberManualRecord
              sx={{
                fontSize: 12,
                color: theme.palette.error.main,
                animation: `${pulse} 1s ease-in-out infinite`,
              }}
            />
            <Typography
              variant="caption"
              fontWeight={600}
              color="error"
              sx={{ fontVariantNumeric: "tabular-nums" }}
            >
              Recording {elapsed}
            </Typography>
          </Box>
        )}

        {/* Record / Stop button */}
        <Tooltip title={isRecording ? "Stop recording" : "Record audio"}>
          <span>
            <IconButton
              size="small"
              onClick={() => onRecordAudio(index, field)}
              disabled={isRecorderBusy && !isRecording}
              sx={{
                width: 36,
                height: 36,
                position: "relative",
                bgcolor: isRecording
                  ? alpha(theme.palette.error.main, 0.1)
                  : alpha(theme.palette.primary.main, 0.08),
                color: isRecording
                  ? theme.palette.error.main
                  : theme.palette.primary.main,
                border: `2px solid ${isRecording ? theme.palette.error.main : alpha(theme.palette.primary.main, 0.3)}`,
                transition: "all 0.2s ease",
                "&:hover": {
                  bgcolor: isRecording
                    ? alpha(theme.palette.error.main, 0.18)
                    : alpha(theme.palette.primary.main, 0.15),
                },
                "&:disabled": {
                  opacity: 0.4,
                },
                // Ripple ring animation when recording
                ...(isRecording && {
                  "&::after": {
                    content: '""',
                    position: "absolute",
                    inset: -4,
                    borderRadius: "50%",
                    border: `2px solid ${theme.palette.error.main}`,
                    animation: `${ripple} 1.5s ease-out infinite`,
                  },
                }),
              }}
            >
              {isRecording ? <Stop fontSize="small" /> : <Mic fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    );
  },
);

AudioFieldCard.displayName = "AudioFieldCard";

const KeywordItem = memo<KeywordItemProps>(
  ({
    index,
    keyword,
    onUpdate,
    onRemove,
    onClearError,
    onRecordAudio,
    isRecordingField,
    isRecorderBusy,
    activeRecording,
  }) => {
    const theme = useTheme();

    return (
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
          borderRadius: 3,
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
          "&:hover": {
            borderColor: alpha(theme.palette.primary.main, 0.3),
            boxShadow: `0 2px 12px ${alpha(theme.palette.primary.main, 0.06)}`,
          },
        }}
      >
        <Stack spacing={2.5}>
          {/* Header */}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Chip
              label={`Keyword ${index + 1}`}
              size="small"
              sx={{
                fontWeight: 600,
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                color: theme.palette.primary.dark,
              }}
            />
            <IconButton
              size="small"
              onClick={() => onRemove(index)}
              sx={{
                color: theme.palette.error.main,
                opacity: 0.6,
                "&:hover": { opacity: 1, bgcolor: alpha(theme.palette.error.main, 0.08) },
              }}
            >
              <DeleteOutline fontSize="small" />
            </IconButton>
          </Stack>

          {/* Word Section */}
          <Typography variant="body2" fontWeight={600} color="primary">
            Word/Phrase
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Japanese Text"
                defaultValue={keyword.japaneseText}
                onChange={() => onClearError(index)}
                onBlur={(e) => onUpdate(index, "japaneseText", e.target.value)}
                placeholder="こんにちは"
                InputProps={{
                  startAdornment: (
                    <Translate sx={{ mr: 1, color: "action.active" }} />
                  ),
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="English Text"
                defaultValue={keyword.englishText}
                onChange={() => onClearError(index)}
                onBlur={(e) => onUpdate(index, "englishText", e.target.value)}
                placeholder="Hello"
                InputProps={{
                  startAdornment: (
                    <Translate sx={{ mr: 1, color: "action.active" }} />
                  ),
                }}
              />
            </Grid>
          </Grid>

          {/* Sentence Section */}
          <Typography variant="body2" fontWeight={600} color="secondary">
            Example Sentences
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Japanese Sentence"
                defaultValue={keyword.japaneseSentence}
                onChange={() => onClearError(index)}
                onBlur={(e) =>
                  onUpdate(index, "japaneseSentence", e.target.value)
                }
                placeholder="こんにちは、元気ですか？"
                InputProps={{
                  startAdornment: (
                    <Translate sx={{ mr: 1, color: "action.active" }} />
                  ),
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="English Sentence"
                defaultValue={keyword.englishSentence}
                onChange={() => onClearError(index)}
                onBlur={(e) =>
                  onUpdate(index, "englishSentence", e.target.value)
                }
                placeholder="Hello, how are you?"
                InputProps={{
                  startAdornment: (
                    <Translate sx={{ mr: 1, color: "action.active" }} />
                  ),
                }}
              />
            </Grid>
          </Grid>

          {/* Audio Section */}
          <Stack direction="row" alignItems="center" spacing={1}>
            <Headphones sx={{ fontSize: 18, color: theme.palette.primary.main }} />
            <Typography variant="body2" fontWeight={600} color="primary">
              Audio Files
            </Typography>
          </Stack>
          <Grid container spacing={2}>
            {(
              [
                "japaneseAudioUrl",
                "englishAudioUrl",
                "japaneseSentenceAudioUrl",
              ] as AudioFieldKey[]
            ).map((audioField) => (
              <Grid size={{ xs: 12, md: 4 }} key={audioField}>
                <AudioFieldCard
                  index={index}
                  field={audioField}
                  label={AUDIO_FIELD_LABELS[audioField]}
                  audioUrl={(keyword as any)[audioField] ?? ""}
                  onUpdate={onUpdate}
                  onClearError={onClearError}
                  onRecordAudio={onRecordAudio}
                  isRecording={isRecordingField(index, audioField)}
                  isRecorderBusy={isRecorderBusy}
                  isAnyRecording={activeRecording !== null}
                />
              </Grid>
            ))}
          </Grid>
        </Stack>
      </Paper>
    );
  },
);

KeywordItem.displayName = "KeywordItem";

export const KeywordsForm: React.FC<KeywordsFormProps> = ({
  control,
  errors,
  clearErrors,
  isMobile,
  setBulkAudioDialog,
}) => {
  const theme = useTheme();
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "keywords",
  });
  const recorderRef = useRef<any>(null);
  const [activeRecording, setActiveRecording] =
    useState<ActiveRecording | null>(null);
  const [isRecorderBusy, setIsRecorderBusy] = useState(false);
  const [recordingPreview, setRecordingPreview] =
    useState<RecordingPreview | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [targetFolder, setTargetFolder] = useState("lessons/keywords");
  const [customFileName, setCustomFileName] = useState("");

  const getRecorder = useCallback(() => {
    if (!recorderRef.current) {
      recorderRef.current = new MicRecorder({ bitRate: 128 });
    }

    return recorderRef.current;
  }, []);

  useEffect(() => {
    return () => {
      if (recordingPreview?.previewUrl) {
        URL.revokeObjectURL(recordingPreview.previewUrl);
      }
    };
  }, [recordingPreview]);

  const addKeyword = useCallback(() => {
    append({
      englishText: "",
      japaneseText: "",
      englishAudioUrl: "",
      japaneseAudioUrl: "",
      englishSentence: "",
      japaneseSentence: "",
      japaneseSentenceAudioUrl: "",
    });
    clearErrors("keywords");
  }, [append, clearErrors]);

  const removeKeyword = useCallback(
    (index: number) => {
      remove(index);
    },
    [remove],
  );

  const updateKeyword = useCallback(
    (index: number, field: keyof Keyword, value: string) => {
      const currentField = fields[index];
      if (currentField) {
        update(index, { ...currentField, [field]: value });
        clearErrors("keywords");
        clearErrors(`keywords.${index}` as any);
      }
    },
    [fields, update, clearErrors],
  );

  const clearKeywordError = useCallback(
    (index: number) => {
      clearErrors("keywords");
      clearErrors(`keywords.${index}` as any);
    },
    [clearErrors],
  );

  const isRecordingField = useCallback(
    (index: number, field: AudioFieldKey) => {
      return (
        activeRecording?.index === index && activeRecording?.field === field
      );
    },
    [activeRecording],
  );

  const closeRecordingPreview = useCallback(() => {
    setRecordingPreview((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl);
      }

      return null;
    });
  }, []);

  const confirmRecordingUpload = useCallback(async () => {
    if (!recordingPreview) {
      return;
    }

    try {
      setIsUploadingAudio(true);

      const extension = recordingPreview.blob.type.includes("wav")
        ? "wav"
        : "mp3";
      const file = new File(
        [recordingPreview.blob],
        `keyword-${recordingPreview.field}-${Date.now()}.${extension}`,
        {
          type: recordingPreview.blob.type || "audio/mpeg",
        },
      );

      const uploadResponse = await communityService.uploadMedia([file], {
        targetFolder,
        customFileName,
      });
      const uploadedUrl = uploadResponse.files?.[0]?.url;

      if (!uploadedUrl) {
        throw new Error("Upload response did not return a file URL.");
      }

      updateKeyword(recordingPreview.index, recordingPreview.field, uploadedUrl);
      closeRecordingPreview();
    } catch (error) {
      console.error("Audio upload failed:", error);
      alert("Failed to upload audio to S3. Please try again.");
    } finally {
      setIsUploadingAudio(false);
    }
  }, [
    closeRecordingPreview,
    customFileName,
    recordingPreview,
    targetFolder,
    updateKeyword,
  ]);

  const recordAudio = useCallback(
    async (index: number, field: AudioFieldKey) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert("Audio recording is not supported in this browser.");
        return;
      }

      const recorder = getRecorder();

      try {
        if (isRecordingField(index, field)) {
          setIsRecorderBusy(true);
          const [, blob] = await recorder.stop().getMp3();
          const previewUrl = URL.createObjectURL(blob);

          setTargetFolder("lessons/keywords");
          setCustomFileName(`keyword-${field}-${index + 1}`);
          setRecordingPreview({ index, field, blob, previewUrl });
          setActiveRecording(null);
          return;
        }

        if (activeRecording) {
          alert("A recording is already in progress. Stop it first.");
          return;
        }

        await navigator.mediaDevices.getUserMedia({ audio: true });
        await recorder.start();
        setActiveRecording({ index, field });
      } catch (error) {
        console.error("Audio recording failed:", error);
        alert("Unable to record audio. Please check microphone permissions.");
        setActiveRecording(null);
      } finally {
        setIsRecorderBusy(false);
      }
    },
    [activeRecording, getRecorder, isRecordingField],
  );

  return (
    <Box>
      <Stack
        direction={isMobile ? "column" : "row"}
        justifyContent="space-between"
        gap={1}
        alignItems="center"
        mb={2}
      >
        <Typography variant="h6">Keywords</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<AddCircleOutline />}
            onClick={addKeyword}
            variant="outlined"
            size="small"
          >
            Add Keyword
          </Button>
          <Button
            variant="outlined"
            startIcon={<CloudUpload />}
            onClick={() => setBulkAudioDialog(true)}
            color="secondary"
            size="small"
          >
            Import from CSV
          </Button>
        </Stack>
      </Stack>

      {errors.keywords && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {String(errors.keywords.message ?? "Please fix keyword errors")}
        </Alert>
      )}

      {fields.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center", bgcolor: "grey.50" }}>
          <Typography color="text.secondary" gutterBottom>
            No keywords added yet. You can:
          </Typography>
          <Stack
            direction="row"
            spacing={2}
            justifyContent="center"
            sx={{ mt: 2 }}
          >
            <Button
              variant="outlined"
              startIcon={<AddCircleOutline />}
              onClick={addKeyword}
            >
              Add Manually
            </Button>
            <Button
              variant="outlined"
              startIcon={<CloudUpload />}
              onClick={() => setBulkAudioDialog(true)}
              color="secondary"
            >
              Import from CSV
            </Button>
          </Stack>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {fields.map((field, index) => (
            <KeywordItem
              key={field.id}
              index={index}
              keyword={field as Keyword}
              onUpdate={updateKeyword}
              onRemove={removeKeyword}
              onClearError={clearKeywordError}
              onRecordAudio={recordAudio}
              isRecordingField={isRecordingField}
              isRecorderBusy={isRecorderBusy}
              activeRecording={activeRecording}
            />
          ))}
        </Stack>
      )}

      {fields.length > 0 && (
        <KeywordsSummary keywords={fields as Keyword[]} isMobile={isMobile} />
      )}

      {/* ── Recording Preview Dialog ─────────────────────────────── */}
      <Dialog
        open={Boolean(recordingPreview)}
        onClose={isUploadingAudio ? undefined : closeRecordingPreview}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: 4,
            overflow: "hidden",
          },
        }}
      >
        {/* Themed header */}
        <Box
          sx={{
            px: 3,
            py: 2.5,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
            color: "#fff",
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Headphones sx={{ fontSize: 24 }} />
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                Preview Recording
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                Listen, then upload to S3 or re-record
              </Typography>
            </Box>
          </Stack>
        </Box>

        <DialogContent sx={{ pt: 3, pb: 2 }}>
          {/* Waveform player */}
          {recordingPreview && (
            <Box sx={{ mb: 3 }}>
              <AudioWaveformPlayer src={recordingPreview.previewUrl} />
            </Box>
          )}

          {/* Field being recorded */}
          {recordingPreview && (
            <Chip
              label={AUDIO_FIELD_LABELS[recordingPreview.field]}
              size="small"
              sx={{
                mb: 2,
                fontWeight: 600,
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                color: theme.palette.primary.dark,
              }}
            />
          )}

          {/* Upload settings */}
          <Stack spacing={2}>
            <TextField
              fullWidth
              size="small"
              label="S3 Folder"
              value={targetFolder}
              onChange={(e) => setTargetFolder(e.target.value)}
              placeholder="lessons/keywords/chapter-1"
              helperText="Exact S3 folder path, e.g. N5 Chapter 7/7.1 Vocabulary"
              disabled={isUploadingAudio}
            />
            <TextField
              fullWidth
              size="small"
              label="Recording Name"
              value={customFileName}
              onChange={(e) => setCustomFileName(e.target.value)}
              placeholder="greeting-japanese"
              helperText="Extension is added automatically from audio format."
              disabled={isUploadingAudio}
            />
          </Stack>
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            py: 2,
            borderTop: `1px solid ${theme.palette.divider}`,
            gap: 1,
          }}
        >
          <Button
            onClick={closeRecordingPreview}
            disabled={isUploadingAudio}
            sx={{
              color: theme.palette.text.secondary,
              "&:hover": {
                bgcolor: alpha(theme.palette.text.secondary, 0.06),
              },
            }}
          >
            Discard
          </Button>
          <Button
            variant="contained"
            onClick={confirmRecordingUpload}
            disabled={isUploadingAudio || !recordingPreview}
            startIcon={
              isUploadingAudio ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <UploadIcon />
              )
            }
            sx={{
              px: 3,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
              "&:hover": {
                background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
              },
            }}
          >
            {isUploadingAudio ? "Uploading…" : "Upload to S3"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
