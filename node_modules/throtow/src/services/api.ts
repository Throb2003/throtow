import { supabase } from '@/lib/supabase';
import type { AppUser } from '@/types/app';

type ProfileRow = {
  id?: string | null;
  name?: string | null;
  full_name?: string | null;
  fullName?: string | null;
  display_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: AppUser['role'] | string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  avatar?: string | null;
  rating?: number | string | null;
  total_jobs?: number | string | null;
  totalJobs?: number | string | null;
  earnings?: number | string | null;
  is_online?: boolean | string | null;
  isOnline?: boolean | string | null;
  location?: AppUser['location'] | null;
  vehicle?: AppUser['vehicle'] | null;
  created_at?: string | null;
  createdAt?: string | null;
  updated_at?: string | null;
  updatedAt?: string | null;
};

const asNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
};

const asBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }
  }

  return fallback;
};

function normalizeProfile(row: ProfileRow): AppUser {
  const fullName =
    row.fullName ??
    row.full_name ??
    row.name ??
    row.display_name ??
    row.email?.split('@')[0] ??
    'User';

  return {
    id: row.id ?? '',
    fullName,
    email: row.email ?? '',
    phone: row.phone ?? '',
    role: (row.role as AppUser['role']) ?? 'customer',
    avatarUrl: row.avatarUrl ?? row.avatar_url ?? row.avatar ?? null,
    rating: asNumber(row.rating, 0),
    totalJobs: asNumber(row.totalJobs ?? row.total_jobs, 0),
    earnings: asNumber(row.earnings, 0),
    isOnline: asBoolean(row.isOnline ?? row.is_online, false),
    location: row.location ?? null,
    vehicle: row.vehicle ?? null,
    createdAt: row.createdAt ?? row.created_at ?? undefined,
    updatedAt: row.updatedAt ?? row.updated_at ?? undefined,
  };
}

// User API
export async function getUser(id: string): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch user', error);
    return null;
  }

  return data ? normalizeProfile(data as ProfileRow) : null;
}
