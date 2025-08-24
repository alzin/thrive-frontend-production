// frontend/src/services/courseService.ts
import api from './api';

export interface Course {
  id: string;
  title: string;
  description: string;
  type: string;
  icon: string;
  isActive: boolean;
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
  lessonType: 'VIDEO' | 'PDF';
  contentUrl?: string;
  pointsReward: number;
  requiresReflection: boolean;
  isCompleted?: boolean;
  completedAt?: string;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  enrolledAt: string;
  course?: Course;
}

export const courseService = {
  async getCourses(): Promise<Course[]> {
    const response = await api.get('/courses');
    return response.data;
  },

  async getCourseById(courseId: string): Promise<Course> {
    const response = await api.get(`/courses/${courseId}`);
    return response.data;
  },

  async getCourseLessons(courseId: string): Promise<Lesson[]> {
    const response = await api.get(`/courses/${courseId}/lessons`);
    return response.data;
  },

  async enrollInCourse(courseId: string): Promise<Enrollment> {
    const response = await api.post(`/courses/${courseId}/enroll`);
    return response.data;
  },

  async getMyEnrollments(): Promise<Enrollment[]> {
    const response = await api.get('/courses/my-enrollments');
    return response.data;
  },

  async checkEnrollment(courseId: string): Promise<boolean> {
    const response = await api.get(`/courses/${courseId}/enrollment-status`);
    return response.data.isEnrolled;
  },

  async completeLesson(lessonId: string, reflectionContent?: string): Promise<void> {
    await api.post(`/courses/lessons/${lessonId}/complete`, { reflectionContent });
  },
};