import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

interface Course {
  id: string;
  title: string;
  description: string;
  type: string;
  icon: string;
  isActive: boolean;
}

interface Lesson {
  id: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
  videoUrl?: string;
  isCompleted?: boolean;
  completedAt?: string;
}

interface CourseState {
  courses: Course[];
  selectedCourse: Course | null;
  lessons: Lesson[];
  selectedLesson: Lesson | null;
  loading: boolean;
  error: string | null;
}

const initialState: CourseState = {
  courses: [],
  selectedCourse: null,
  lessons: [],
  selectedLesson: null,
  loading: false,
  error: null,
};

export const fetchCourses = createAsyncThunk('course/fetchCourses', async () => {
  const response = await api.get('/courses');
  return response.data;
});

export const fetchCourseLessons = createAsyncThunk(
  'course/fetchLessons',
  async (courseId: string) => {
    const response = await api.get(`/courses/${courseId}/lessons`);
    return response.data;
  }
);

export const completeLesson = createAsyncThunk(
  'course/completeLesson',
  async ({ lessonId, reflectionContent }: { lessonId: string; reflectionContent?: string }) => {
    const response = await api.post(`/courses/lessons/${lessonId}/complete`, { reflectionContent });
    return response.data;
  }
);

const courseSlice = createSlice({
  name: 'course',
  initialState,
  reducers: {
    selectCourse: (state, action) => {
      state.selectedCourse = action.payload;
    },
    selectLesson: (state, action) => {
      state.selectedLesson = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCourses.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCourses.fulfilled, (state, action) => {
        state.loading = false;
        state.courses = action.payload;
      })
      .addCase(fetchCourses.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch courses';
      })
      .addCase(fetchCourseLessons.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCourseLessons.fulfilled, (state, action) => {
        state.loading = false;
        state.lessons = action.payload;
      })
      .addCase(fetchCourseLessons.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch lessons';
      })
      .addCase(completeLesson.fulfilled, (state, action) => {
        const lessonId = action.meta.arg.lessonId;
        const lessonIndex = state.lessons.findIndex(l => l.id === lessonId);
        if (lessonIndex !== -1) {
          state.lessons[lessonIndex].isCompleted = true;
          state.lessons[lessonIndex].completedAt = new Date().toISOString();
        }
      });
  },
});

export const { selectCourse, selectLesson, clearError } = courseSlice.actions;
export default courseSlice.reducer;