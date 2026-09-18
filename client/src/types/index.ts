export type AuthUser = {
  id: string;
  email: string;
  role: string;
};

export type DashboardSummary = {
  summary: {
    totalEmployees: number;
    activeEmployees: number;
    presentToday: number;
    lateToday: number;
    absentToday: number;
    onTimeRate: number;
    lateRate: number;
    absentRate: number;
  };
  recentRecords: Array<{
    id: string;
    employeeName: string;
    status: string;
    checkIn: string;
    checkOut?: string | null;
  }>;
};
