const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Request failed.');
  }

  return data as T;
}

export async function loginUser(email: string, password: string) {
  return apiRequest<{ token: string; user: { id: string; email: string; role: string } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function registerUser(email: string, password: string, role: string = 'ADMIN') {
  return apiRequest<{ token: string; user: { id: string; email: string; role: string } }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, role }),
  });
}

export async function fetchCurrentUser(token: string) {
  return apiRequest<{ user: { id: string; email: string; role: string } }>('/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function fetchDashboardSummary(token: string) {
  return apiRequest<{
    summary: {
      totalEmployees?: number;
      activeEmployees?: number;
      presentToday?: number;
      lateToday?: number;
      absentToday?: number;
      onTimeRate?: number;
      lateRate?: number;
      absentRate?: number;
      totalHours?: number;
      totalBonus?: number;
      totalSalary?: number;
    };
    recentRecords: Array<{
      id: string;
      employeeName: string;
      status: string;
      checkIn: string;
      checkOut?: string | null;
      totalHours?: number | null;
      bonus?: number | null;
    }>;
  }>('/dashboard/summary', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export type Employee = {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  department?: string | null;
  position?: string | null;
  hourlyRate: number;
  isActive: boolean;
};

export type AttendanceEntry = {
  id: string;
  employeeId: string;
  checkIn: string;
  checkOut?: string | null;
  totalHours?: number | null;
  bonus?: number | null;
  notes?: string | null;
  status: string;
};

export async function fetchEmployees(token: string) {
  return apiRequest<{ employees: Employee[] }>('/employees', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function createEmployee(token: string, payload: Partial<Employee>) {
  return apiRequest<{ employee: Employee }>('/employees', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function updateEmployee(token: string, id: string, payload: Partial<Employee>) {
  return apiRequest<{ employee: Employee }>(`/employees/${id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function resetEmployeePassword(token: string, id: string, password: string) {
  return apiRequest<{ message: string }>(`/employees/${id}/password`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ password }),
  });
}

export async function deleteEmployee(token: string, id: string) {
  return apiRequest<{ message: string }>(`/employees/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function fetchAttendanceByEmployee(token: string, employeeId: string) {
  return apiRequest<{ attendance: AttendanceEntry[] }>(`/employees/${employeeId}/attendance`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function createAttendanceRecord(token: string, employeeId: string, payload: Partial<AttendanceEntry> & { checkIn: string; checkOut?: string | null; totalHours?: number | string | null; bonus?: number | string | null; notes?: string | null; status?: string }) {
  return apiRequest<{ attendance: AttendanceEntry }>(`/employees/${employeeId}/attendance`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function updateAttendanceRecord(token: string, employeeId: string, recordId: string, payload: Partial<AttendanceEntry> & { checkIn?: string; checkOut?: string | null; totalHours?: number | string | null; bonus?: number | string | null; notes?: string | null; status?: string }) {
  return apiRequest<{ attendance: AttendanceEntry }>(`/employees/${employeeId}/attendance/${recordId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function deleteAttendanceRecord(token: string, employeeId: string, recordId: string) {
  return apiRequest<{ message: string }>(`/employees/${employeeId}/attendance/${recordId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
