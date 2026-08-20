export type Role = 'ADMIN' | 'STUDENT'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  isActive?: boolean
  createdAt?: string
}

export interface LessonProgress {
  lessonId: string
  positionSeconds: number
  maxPositionSeconds: number
  durationSeconds: number
  completed: boolean
  completionMode: 'AUTO' | 'MANUAL'
  lastWatchedAt: string
}

export interface Lesson {
  id: string
  title: string
  description: string
  s3Key: string
  sortOrder: number
  durationSeconds: number | null
  progress: LessonProgress | null
}

export interface Section {
  id: string
  title: string
  sortOrder: number
  lessons: Lesson[]
}

export interface Course {
  id: string
  title: string
  description: string
  published: boolean
  sortOrder: number
  sections: Section[]
  stats: { totalLessons: number; completedLessons: number; percent: number }
}

export interface S3Object {
  key: string
  size: number
  lastModified: string | null
}

export interface DashboardSummary {
  counts: {
    students: { total: number; active: number; activeLast7Days: number }
    courses: { total: number; published: number }
    sections: number
    lessons: number
  }
  storage: { available: boolean; objectCount: number; totalBytes: number }
  learning: {
    progressRecords: number
    completedRecords: number
    completionRate: number
    topCourses: Array<{ id: string; title: string; viewers: number; completedLessons: number }>
    recentActivity: Array<{ userName: string; courseTitle: string; lessonTitle: string; lastWatchedAt: string; completed: boolean }>
  }
}

export type AwsCostReport =
  | {
      available: true
      currency: string
      currentMonth: { amount: number; estimated: boolean }
      previousMonthAmount: number
      changePercent: number | null
      monthly: Array<{ month: string; amount: number; estimated: boolean }>
      services: Array<{ name: string; amount: number }>
      refreshedAt: string
      stale: boolean
    }
  | {
      available: false
      reason: 'NOT_AUTHORIZED' | 'NOT_ENABLED' | 'UNAVAILABLE'
      refreshedAt: string
      stale: boolean
    }
