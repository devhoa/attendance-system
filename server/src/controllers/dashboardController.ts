import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

function getStartOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function getEndOfToday() {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return now;
}

function getHoursFromRange(checkIn: Date, checkOut?: Date | null, totalHours?: number | null) {
  if (typeof totalHours === 'number' && Number.isFinite(totalHours)) {
    return totalHours;
  }

  if (!checkOut) {
    return 0;
  }

  const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(diffMs / (1000 * 60 * 60), 0);
}

export async function getDashboardOverview(req: Request, res: Response) {
  const user = (req as any).user;
  const todayStart = getStartOfToday();
  const todayEnd = getEndOfToday();

  if (user?.role === 'EMPLOYEE') {
    const employee = await prisma.employee.findUnique({
      where: { email: String(user.email).trim().toLowerCase() },
      include: { attendance: { orderBy: { checkIn: 'desc' }, take: 10 } },
    });

    if (!employee) {
      return res.json({
        summary: {
          totalEmployees: 0,
          totalHours: 0,
          totalBonus: 0,
          totalSalary: 0,
        },
        recentRecords: [],
      });
    }

    const records = employee.attendance;
    const totalHours = records.reduce((sum, record) => sum + getHoursFromRange(record.checkIn, record.checkOut, record.totalHours), 0);
    const totalBonus = records.reduce((sum, record) => sum + Number(record.bonus ?? 0), 0);
    const totalSalary = records.reduce((sum, record) => {
      const hours = getHoursFromRange(record.checkIn, record.checkOut, record.totalHours);
      return sum + hours * Number(employee.hourlyRate || 250000) + Number(record.bonus ?? 0);
    }, 0);

    return res.json({
      summary: {
        totalEmployees: 1,
        totalHours,
        totalBonus,
        totalSalary,
      },
      recentRecords: records.map((record) => ({
        id: record.id,
        employeeName: employee.fullName,
        status: record.status,
        checkIn: record.checkIn,
        checkOut: record.checkOut,
        totalHours: getHoursFromRange(record.checkIn, record.checkOut, record.totalHours),
        bonus: Number(record.bonus ?? 0),
      })),
    });
  }

  const [employeeCount, activeEmployees, presentToday, lateToday, absentToday, recentRecords] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { isActive: true } }),
    prisma.attendanceRecord.count({
      where: {
        checkIn: {
          gte: todayStart,
          lte: todayEnd,
        },
        status: { in: ['PRESENT', 'HALF_DAY'] },
      },
    }),
    prisma.attendanceRecord.count({
      where: {
        checkIn: {
          gte: todayStart,
          lte: todayEnd,
        },
        status: 'LATE',
      },
    }),
    prisma.attendanceRecord.count({
      where: {
        checkIn: {
          gte: todayStart,
          lte: todayEnd,
        },
        status: 'ABSENT',
      },
    }),
    prisma.attendanceRecord.findMany({
      take: 5,
      orderBy: { checkIn: 'desc' },
      include: {
        employee: true,
      },
    }),
  ]);

  const onTimeRate = employeeCount > 0 ? Math.round((presentToday / employeeCount) * 100) : 0;
  const lateRate = employeeCount > 0 ? Math.round((lateToday / employeeCount) * 100) : 0;
  const absentRate = employeeCount > 0 ? Math.round((absentToday / employeeCount) * 100) : 0;

  res.json({
    summary: {
      totalEmployees: employeeCount,
      activeEmployees,
      presentToday,
      lateToday,
      absentToday,
      onTimeRate,
      lateRate,
      absentRate,
    },
    recentRecords: recentRecords.map((record) => ({
      id: record.id,
      employeeName: record.employee.fullName,
      status: record.status,
      checkIn: record.checkIn,
      checkOut: record.checkOut,
      totalHours: getHoursFromRange(record.checkIn, record.checkOut, record.totalHours),
      bonus: Number(record.bonus ?? 0),
    })),
  });
}
