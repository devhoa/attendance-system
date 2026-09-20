import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

async function syncMissingEmployeeProfiles() {
  const employeeUsers = await prisma.user.findMany({
    where: { role: 'EMPLOYEE' },
    select: { email: true },
  });

  for (const user of employeeUsers) {
    const normalizedEmail = String(user.email).trim().toLowerCase();
    const existing = await prisma.employee.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      continue;
    }

    const baseName = normalizedEmail.split('@')[0] ?? 'Employee';
    const fullName = baseName
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Employee';

    await prisma.employee.create({
      data: {
        email: normalizedEmail,
        fullName,
        hourlyRate: 250000,
        isActive: true,
      },
    });
  }
}

async function syncEmployeeUserAccount(employeeEmail: string, password?: string) {
  const normalizedEmail = String(employeeEmail).trim().toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    if (password && String(password).length >= 6) {
      const passwordHash = await bcrypt.hash(String(password), 10);
      await prisma.user.update({
        where: { email: normalizedEmail },
        data: { password: passwordHash },
      });
    }

    return existingUser;
  }

  if (!password || String(password).length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const passwordHash = await bcrypt.hash(String(password), 10);

  return prisma.user.create({
    data: {
      email: normalizedEmail,
      password: passwordHash,
      role: 'EMPLOYEE',
    },
  });
}

async function getEmployeeForCurrentUser(userEmail: string) {
  return prisma.employee.findUnique({
    where: { email: String(userEmail).trim().toLowerCase() },
  });
}

function isAdminLike(role?: string) {
  return ['ADMIN', 'MANAGER', 'HR'].includes(String(role ?? '').toUpperCase());
}

router.get('/', requireAuth, async (req, res) => {
  if (!isAdminLike(req.user?.role)) {
    const employee = await getEmployeeForCurrentUser(req.user?.email ?? '');

    if (!employee) {
      return res.status(403).json({ message: 'You can only view your own employee profile.' });
    }

    return res.json({ employees: [employee] });
  }

  await syncMissingEmployeeProfiles();

  const employees = await prisma.employee.findMany({
    orderBy: { fullName: 'asc' },
  });

  return res.json({ employees });
});

router.get('/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id);

  if (!isAdminLike(req.user?.role)) {
    const employee = await getEmployeeForCurrentUser(req.user?.email ?? '');

    if (!employee || employee.id !== id) {
      return res.status(403).json({ message: 'You can only view your own employee information.' });
    }
  }

  const employee = await prisma.employee.findUnique({
    where: { id },
  });

  if (!employee) {
    return res.status(404).json({ message: 'Employee not found.' });
  }

  return res.json({ employee });
});

router.get('/:id/attendance', requireAuth, async (req, res) => {
  const id = String(req.params.id);

  if (!isAdminLike(req.user?.role)) {
    const employee = await getEmployeeForCurrentUser(req.user?.email ?? '');

    if (!employee || employee.id !== id) {
      return res.status(403).json({ message: 'You can only view your own attendance records.' });
    }
  }

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { attendance: { orderBy: { checkIn: 'desc' } } },
  });

  if (!employee) {
    return res.status(404).json({ message: 'Employee not found.' });
  }

  return res.json({ attendance: employee.attendance });
});

router.post('/:id/attendance', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const { checkIn, checkOut, totalHours, bonus, notes, status } = req.body ?? {};

  if (!isAdminLike(req.user?.role)) {
    const employee = await getEmployeeForCurrentUser(req.user?.email ?? '');

    if (!employee || employee.id !== id) {
      return res.status(403).json({ message: 'Employees can only add attendance for their own profile.' });
    }
  }

  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) {
    return res.status(404).json({ message: 'Employee not found.' });
  }

  if (!checkIn) {
    return res.status(400).json({ message: 'Check-in time is required.' });
  }

  const parsedCheckIn = new Date(String(checkIn));
  if (Number.isNaN(parsedCheckIn.getTime())) {
    return res.status(400).json({ message: 'Invalid check-in time.' });
  }

  const parsedCheckOut = checkOut ? new Date(String(checkOut)) : null;
  if (checkOut && Number.isNaN(parsedCheckOut?.getTime() ?? NaN)) {
    return res.status(400).json({ message: 'Invalid check-out time.' });
  }

  const finalTotalHours = typeof totalHours === 'number' || typeof totalHours === 'string'
    ? Number(totalHours)
    : parsedCheckOut
      ? (parsedCheckOut.getTime() - parsedCheckIn.getTime()) / (1000 * 60 * 60)
      : null;

  const normalizedStatus = typeof status === 'string' ? status.toUpperCase() : 'PRESENT';

  const attendance = await prisma.attendanceRecord.create({
    data: {
      employeeId: id,
      checkIn: parsedCheckIn,
      checkOut: parsedCheckOut,
      totalHours: Number.isFinite(finalTotalHours) ? finalTotalHours : null,
      bonus: typeof bonus === 'number' || typeof bonus === 'string' ? Number(bonus) : null,
      notes: typeof notes === 'string' ? notes.trim() || null : null,
      status: normalizedStatus as 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY' | 'HOLIDAY',
    },
  });

  return res.status(201).json({ attendance });
});

router.put('/:id/attendance/:recordId', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const recordId = String(req.params.recordId);
  const { checkIn, checkOut, totalHours, bonus, notes, status } = req.body ?? {};

  if (!isAdminLike(req.user?.role)) {
    const employee = await getEmployeeForCurrentUser(req.user?.email ?? '');

    if (!employee || employee.id !== id) {
      return res.status(403).json({ message: 'Employees can only update their own attendance.' });
    }
  }

  const existingRecord = await prisma.attendanceRecord.findUnique({ where: { id: recordId } });
  if (!existingRecord || existingRecord.employeeId !== id) {
    return res.status(404).json({ message: 'Attendance record not found.' });
  }

  if (!checkIn) {
    return res.status(400).json({ message: 'Check-in time is required.' });
  }

  const parsedCheckIn = new Date(String(checkIn));
  if (Number.isNaN(parsedCheckIn.getTime())) {
    return res.status(400).json({ message: 'Invalid check-in time.' });
  }

  const parsedCheckOut = checkOut ? new Date(String(checkOut)) : null;
  if (checkOut && Number.isNaN(parsedCheckOut?.getTime() ?? NaN)) {
    return res.status(400).json({ message: 'Invalid check-out time.' });
  }

  const finalTotalHours = typeof totalHours === 'number' || typeof totalHours === 'string'
    ? Number(totalHours)
    : parsedCheckOut
      ? (parsedCheckOut.getTime() - parsedCheckIn.getTime()) / (1000 * 60 * 60)
      : existingRecord.totalHours ?? null;

  const normalizedStatus = typeof status === 'string' ? status.toUpperCase() : existingRecord.status;

  const attendance = await prisma.attendanceRecord.update({
    where: { id: recordId },
    data: {
      checkIn: parsedCheckIn,
      checkOut: parsedCheckOut,
      totalHours: Number.isFinite(finalTotalHours) ? finalTotalHours : null,
      bonus: typeof bonus === 'number' || typeof bonus === 'string' ? Number(bonus) : existingRecord.bonus,
      notes: typeof notes === 'string' ? notes.trim() || null : existingRecord.notes,
      status: normalizedStatus as 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY' | 'HOLIDAY',
    },
  });

  return res.json({ attendance });
});

router.delete('/:id/attendance/:recordId', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const recordId = String(req.params.recordId);

  if (!isAdminLike(req.user?.role)) {
    const employee = await getEmployeeForCurrentUser(req.user?.email ?? '');

    if (!employee || employee.id !== id) {
      return res.status(403).json({ message: 'Employees can only modify their own attendance.' });
    }
  }

  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) {
    return res.status(404).json({ message: 'Employee not found.' });
  }

  await prisma.attendanceRecord.delete({ where: { id: recordId } });

  return res.json({ message: 'Attendance record deleted successfully.' });
});

router.post('/', requireAuth, async (req, res) => {
  if (!isAdminLike(req.user?.role)) {
    return res.status(403).json({ message: 'Only admin-level users can create employee accounts.' });
  }

  const { fullName, email, phone, department, position, hourlyRate, isActive } = req.body ?? {};

  if (!fullName || !email) {
    return res.status(400).json({ message: 'Employee name and email are required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const existingEmployee = await prisma.employee.findUnique({
    where: { email: normalizedEmail },
  });

  const employee = await prisma.employee.upsert({
    where: { email: normalizedEmail },
    update: {
      fullName: String(fullName),
      phone: phone ? String(phone) : null,
      department: department ? String(department) : null,
      position: position ? String(position) : null,
      hourlyRate: Number.isFinite(Number(hourlyRate)) ? Number(hourlyRate) : 250000,
      isActive: typeof isActive === 'boolean' ? isActive : true,
    },
    create: {
      fullName: String(fullName),
      email: normalizedEmail,
      phone: phone ? String(phone) : null,
      department: department ? String(department) : null,
      position: position ? String(position) : null,
      hourlyRate: Number.isFinite(Number(hourlyRate)) ? Number(hourlyRate) : 250000,
      isActive: typeof isActive === 'boolean' ? isActive : true,
    },
  });

  return res.status(existingEmployee ? 200 : 201).json({ employee });
});

router.put('/:id', requireAuth, async (req, res) => {
  if (!isAdminLike(req.user?.role)) {
    return res.status(403).json({ message: 'Only admin-level users can update employee accounts.' });
  }

  const id = String(req.params.id);
  const { fullName, email, phone, department, position, hourlyRate, isActive } = req.body ?? {};

  if (!fullName || !email) {
    return res.status(400).json({ message: 'Employee name and email are required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const existingEmployee = await prisma.employee.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingEmployee && existingEmployee.id !== id) {
    return res.status(409).json({ message: 'An employee with this email already exists.' });
  }

  const employee = await prisma.employee.update({
    where: { id },
    data: {
      fullName: String(fullName),
      email: normalizedEmail,
      phone: phone ? String(phone) : null,
      department: department ? String(department) : null,
      position: position ? String(position) : null,
      hourlyRate: Number.isFinite(Number(hourlyRate)) ? Number(hourlyRate) : 250000,
      isActive: typeof isActive === 'boolean' ? isActive : true,
    },
  });

  if (employee.email) {
    const user = await prisma.user.findUnique({ where: { email: employee.email } });
    if (user && user.role !== 'EMPLOYEE') {
      await prisma.user.update({
        where: { email: employee.email },
        data: { email: employee.email },
      });
    }
  }

  return res.json({ employee });
});

router.put('/:id/password', requireAuth, async (req, res) => {
  if (!isAdminLike(req.user?.role)) {
    return res.status(403).json({ message: 'Only admin-level users can reset employee passwords.' });
  }

  const id = String(req.params.id);
  const { password } = req.body ?? {};

  if (!password || String(password).length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  const employee = await prisma.employee.findUnique({ where: { id } });

  if (!employee) {
    return res.status(404).json({ message: 'Employee not found.' });
  }

  await syncEmployeeUserAccount(employee.email, String(password));

  return res.json({ message: 'Employee password updated successfully.' });
});

router.delete('/:id', requireAuth, async (req, res) => {
  if (!isAdminLike(req.user?.role)) {
    return res.status(403).json({ message: 'Only admin-level users can delete employee accounts.' });
  }

  const id = String(req.params.id);

  await prisma.employee.delete({
    where: { id },
  });

  return res.json({ message: 'Employee deleted successfully.' });
});

export default router;
