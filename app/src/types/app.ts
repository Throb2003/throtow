export type UserRole = 'customer' | 'driver' | 'mechanic' | 'admin';
export type ServiceType = 'tow' | 'tire' | 'battery' | 'lockout' | 'fuel' | 'mechanic';

export type RequestStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'rejected';

export type JobStatus =
  | 'available'
  | 'accepted'
  | 'en_route'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type PaymentStatus =
  | 'pending'
  | 'initiated'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled';

export type PaymentMethod = 'mpesa' | 'cash' | 'card';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface LocationPoint {
  lat: number;
  lng: number;
  address: string;
  landmark?: string | null;
}

export interface VehicleInfo {
  make: string;
  model: string;
  color: string;
  plate?: string | null;
}

export interface VehicleProfile {
  type: string;
  plate: string;
  model: string;
}

export interface AppUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string | null;
  rating?: number | null;
  totalJobs?: number | null;
  earnings?: number | null;
  isOnline?: boolean;
  location?: LocationPoint | null;
  vehicle?: VehicleProfile | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceRequest {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAvatar?: string | null;
  serviceType: ServiceType;
  status: RequestStatus;
  location: LocationPoint;
  destination?: LocationPoint | null;
  description: string;
  vehicleInfo: VehicleInfo;
  assignedTo?: string | null;
  assignedName?: string | null;
  assignedAvatar?: string | null;
  price: number;
  finalPrice?: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  estimatedArrival?: number | null;
  rating?: number | null;
  review?: string | null;
  paymentStatus?: PaymentStatus | null;
  paymentMethod?: PaymentMethod | null;
  serviceProviderRole?: Extract<UserRole, 'driver' | 'mechanic'> | null;
}

export interface Job {
  id: string;
  requestId: string;
  driverId?: string | null;
  mechanicId?: string | null;
  status: JobStatus;
  earnings: number;
  distance: number;
  pickupLocation: LocationPoint;
  destination?: LocationPoint | null;
  customerName: string;
  customerPhone: string;
  serviceType: string;
  vehicleInfo: string;
  createdAt: string;
  acceptedAt?: string | null;
  completedAt?: string | null;
}

export interface PaymentRecord {
  id: string;
  requestId: string;
  customerId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  phoneNumber: string;
  merchantRequestId?: string | null;
  checkoutRequestId?: string | null;
  receiptNumber?: string | null;
  transactionDate?: string | null;
  resultCode?: string | null;
  resultDescription?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  actionUrl?: string | null;
}

export interface RequestMessage {
  id: string;
  requestId: string;
  senderId: string;
  senderRole: UserRole;
  senderName: string;
  message: string;
  createdAt: string;
}

export interface AnalyticsSummary {
  totalUsers: number;
  totalDrivers: number;
  totalMechanics: number;
  totalCustomers: number;
  totalRequests: number;
  completedRequests: number;
  pendingRequests: number;
  totalRevenue: number;
  driverEarnings: number;
  mechanicEarnings: number;
  platformEarnings: number;
  averageRating: number;
  averageResponseTime: number;
}

export interface PricingSettings {
  towBaseRate: number;
  towRatePerKm: number;
  batteryJumpstartRate: number;
  tireChangeRate: number;
  fuelDeliveryRate: number;
  lockoutRate: number;
  mechanicInspectionRate: number;
  driverCommissionPercent: number;
  mechanicCommissionPercent: number;
}

export interface CreateServiceRequestInput {
  serviceType: ServiceType;
  location: LocationPoint;
  destination?: LocationPoint | null;
  description: string;
  vehicleInfo: VehicleInfo;
}

export interface RegisterUserInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: Exclude<UserRole, 'admin'>;
}

export interface MpesaStkPushInput {
  requestId: string;
  amount: number;
  phoneNumber: string;
  accountReference: string;
  transactionDesc: string;
}

export interface MpesaStkPushResult {
  merchantRequestId: string;
  checkoutRequestId: string;
  customerMessage: string;
  responseCode: string;
  responseDescription: string;
}

export function getServiceTypeLabel(type: ServiceType | string): string {
  const labels: Record<string, string> = {
    tow: 'Towing',
    tire: 'Tire Change',
    battery: 'Battery Jumpstart',
    lockout: 'Car Unlock',
    fuel: 'Fuel Delivery',
    mechanic: 'Mobile Mechanic',
  };

  return labels[type] || type;
}

export function getServiceTypeIcon(type: ServiceType | string): string {
  const icons: Record<string, string> = {
    tow: '🚛',
    tire: '🔧',
    battery: '🔋',
    lockout: '🔑',
    fuel: '⛽',
    mechanic: '🛠️',
  };

  return icons[type] || '🚗';
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-500',
    assigned: 'bg-blue-500',
    in_progress: 'bg-orange-500',
    completed: 'bg-green-500',
    cancelled: 'bg-red-500',
    rejected: 'bg-rose-500',
    available: 'bg-green-500',
    accepted: 'bg-blue-500',
    en_route: 'bg-orange-500',
    arrived: 'bg-purple-500',
    initiated: 'bg-blue-500',
    processing: 'bg-orange-500',
    paid: 'bg-green-500',
    failed: 'bg-red-500',
  };

  return colors[status] || 'bg-gray-500';
}

// ============================================
// Production-Grade Types
// ============================================

/** Provider status for drivers/mechanics */
export interface ProviderStatus {
  isOnline: boolean;
  isOnJob: boolean;
  currentLocation: LocationPoint | null;
  lastSeen: string | null;
  isVerified: boolean;
  currentJobId: string | null;
}

/** Location update payload for real-time tracking */
export interface LocationUpdate {
  lat: number;
  lng: number;
  address?: string;
  accuracy?: number;
  timestamp: string;
}

/** Audit log entry for tracking changes */
export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  tableName: string;
  recordId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

/** Extended user profile with provider status */
export interface AppUserExtended extends AppUser {
  isOnJob: boolean;
  currentLocation: LocationPoint | null;
  lastSeen: string | null;
  isVerified: boolean;
  currentJobId: string | null;
}

/** Job completion input */
export interface CompleteJobInput {
  jobId: string;
  rating?: number;
  review?: string;
  finalPrice?: number;
}

/** Online status toggle input */
export interface SetOnlineStatusInput {
  isOnline: boolean;
}

/** Analytics time range */
export type AnalyticsTimeRange = 'today' | 'week' | 'month' | 'year' | 'all';

/** Revenue analytics data */
export interface RevenueAnalytics {
  totalRevenue: number;
  revenueByDay: Array<{ date: string; amount: number }>;
  revenueByService: Array<{ serviceType: ServiceType; amount: number }>;
  averageTransaction: number;
  totalTransactions: number;
}

/** User activity analytics */
export interface UserActivityAnalytics {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  onlineProviders: number;
  providersByRole: {
    drivers: number;
    mechanics: number;
  };
}

/** Service request analytics */
export interface ServiceRequestAnalytics {
  totalRequests: number;
  completedRequests: number;
  cancelledRequests: number;
  averageCompletionTime: number;
  requestsByService: Array<{ serviceType: ServiceType; count: number }>;
  requestsByStatus: Array<{ status: RequestStatus; count: number }>;
}

/** Payment analytics */
export interface PaymentAnalytics {
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  totalAmount: number;
  averageAmount: number;
  paymentsByMethod: Array<{ method: PaymentMethod; count: number; amount: number }>;
}

/** Complete admin analytics dashboard data */
export interface AdminAnalytics {
  revenue: RevenueAnalytics;
  users: UserActivityAnalytics;
  serviceRequests: ServiceRequestAnalytics;
  payments: PaymentAnalytics;
  topProviders: Array<{ id: string; name: string; role: UserRole; totalJobs: number; rating: number }>;
  recentTransactions: PaymentRecord[];
}

/** Zod validation schemas (imported from validation module) */
export type ValidationSchema = {
  serviceRequest: unknown;
  registerUser: unknown;
  locationUpdate: unknown;
  payment: unknown;
};

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    assigned: 'Assigned',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    rejected: 'Rejected',
    available: 'Available',
    accepted: 'Accepted',
    en_route: 'En Route',
    arrived: 'Arrived',
    initiated: 'Initiated',
    processing: 'Processing',
    paid: 'Paid',
    failed: 'Failed',
  };

  return labels[status] || status;
}

export function formatCurrency(amount: number): string {
  return `KES ${Number(amount || 0).toLocaleString('en-KE')}`;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

export function getProviderRoleForService(
  serviceType: ServiceType
): Extract<UserRole, 'driver' | 'mechanic'> {
  if (serviceType === 'tow') return 'driver';
  return 'mechanic';
}

export function estimateBasePrice(
  serviceType: ServiceType,
  pricing?: Partial<PricingSettings>
): number {
  const defaults: PricingSettings = {
    towBaseRate: 2500,
    towRatePerKm: 300,
    batteryJumpstartRate: 800,
    tireChangeRate: 1200,
    fuelDeliveryRate: 500,
    lockoutRate: 1500,
    mechanicInspectionRate: 1800,
    driverCommissionPercent: 15,
    mechanicCommissionPercent: 15,
  };

  const config = { ...defaults, ...pricing };

  switch (serviceType) {
    case 'tow':
      return config.towBaseRate;
    case 'battery':
      return config.batteryJumpstartRate;
    case 'tire':
      return config.tireChangeRate;
    case 'fuel':
      return config.fuelDeliveryRate;
    case 'lockout':
      return config.lockoutRate;
    case 'mechanic':
      return config.mechanicInspectionRate;
    default:
      return 0;
  }
}
