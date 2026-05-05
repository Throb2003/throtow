import type { User } from '@/contexts/AuthContext';

export interface ServiceRequest {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAvatar?: string;
  serviceType: 'tow' | 'tire' | 'battery' | 'lockout' | 'fuel' | 'mechanic';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  location: {
    lat: number;
    lng: number;
    address: string;
    landmark?: string;
  };
  destination?: {
    lat: number;
    lng: number;
    address: string;
  };
  description: string;
  vehicleInfo: {
    make: string;
    model: string;
    color: string;
    plate?: string;
  };
  assignedTo?: string;
  assignedName?: string;
  assignedAvatar?: string;
  price: number;
  finalPrice?: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  estimatedArrival?: number; // minutes
  rating?: number;
  review?: string;
}

export interface Job {
  id: string;
  requestId: string;
  driverId?: string;
  mechanicId?: string;
  status: 'available' | 'accepted' | 'en_route' | 'arrived' | 'in_progress' | 'completed';
  earnings: number;
  distance: number;
  pickupLocation: {
    address: string;
    lat: number;
    lng: number;
  };
  destination?: {
    address: string;
    lat: number;
    lng: number;
  };
  customerName: string;
  customerPhone: string;
  serviceType: string;
  vehicleInfo: string;
  createdAt: string;
  acceptedAt?: string;
  completedAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

export interface Analytics {
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

// Mock Service Requests
export const mockServiceRequests: ServiceRequest[] = [
  {
    id: 'req-001',
    customerId: 'cust-001',
    customerName: 'John Kamau',
    customerPhone: '+254 712 345 678',
    customerAvatar: 'https://ui-avatars.com/api/?name=John+Kamau&background=FF2D2D&color=fff',
    serviceType: 'tow',
    status: 'completed',
    location: {
      lat: -1.2921,
      lng: 36.8219,
      address: 'Mombasa Road, Near City Mall',
      landmark: 'Next to Total Petrol Station',
    },
    destination: {
      lat: -1.2845,
      lng: 36.8234,
      address: 'Kenyatta Avenue Garage',
    },
    description: 'Car won\'t start, need towing to garage',
    vehicleInfo: { make: 'Toyota', model: 'Corolla', color: 'Silver', plate: 'KAZ 123B' },
    assignedTo: 'drv-001',
    assignedName: 'Peter Ochieng',
    assignedAvatar: 'https://ui-avatars.com/api/?name=Peter+Ochieng&background=10b981&color=fff',
    price: 2500,
    finalPrice: 2500,
    createdAt: '2024-03-30T10:00:00Z',
    updatedAt: '2024-03-30T11:30:00Z',
    completedAt: '2024-03-30T11:30:00Z',
    estimatedArrival: 15,
    rating: 5,
    review: 'Excellent service! Arrived quickly and was very professional.',
  },
  {
    id: 'req-002',
    customerId: 'cust-002',
    customerName: 'Mary Wanjiku',
    customerPhone: '+254 723 456 789',
    customerAvatar: 'https://ui-avatars.com/api/?name=Mary+Wanjiku&background=f59e0b&color=fff',
    serviceType: 'battery',
    status: 'in_progress',
    location: {
      lat: -1.3001,
      lng: 36.7900,
      address: 'Karen Shopping Center',
      landmark: 'Parking Lot B',
    },
    description: 'Battery died, need jumpstart',
    vehicleInfo: { make: 'Honda', model: 'CR-V', color: 'Black', plate: 'KBX 456C' },
    assignedTo: 'mec-001',
    assignedName: 'James Mwangi',
    assignedAvatar: 'https://ui-avatars.com/api/?name=James+Mwangi&background=3b82f6&color=fff',
    price: 800,
    createdAt: '2024-03-31T08:30:00Z',
    updatedAt: '2024-03-31T08:45:00Z',
    estimatedArrival: 10,
  },
  {
    id: 'req-003',
    customerId: 'cust-003',
    customerName: 'David Omondi',
    customerPhone: '+254 734 567 890',
    serviceType: 'tire',
    status: 'assigned',
    location: {
      lat: -1.2845,
      lng: 36.8234,
      address: 'Uhuru Highway',
      landmark: 'Near Nyayo Stadium',
    },
    description: 'Flat tire, need replacement',
    vehicleInfo: { make: 'Nissan', model: 'X-Trail', color: 'White', plate: 'KCY 789D' },
    assignedTo: 'drv-002',
    assignedName: 'Alice Akinyi',
    price: 1200,
    createdAt: '2024-03-31T09:00:00Z',
    updatedAt: '2024-03-31T09:15:00Z',
    estimatedArrival: 20,
  },
  {
    id: 'req-004',
    customerId: 'cust-004',
    customerName: 'Grace Muthoni',
    customerPhone: '+254 745 678 901',
    serviceType: 'fuel',
    status: 'pending',
    location: {
      lat: -1.3100,
      lng: 36.8100,
      address: 'Langata Road',
      landmark: 'Near Carnivore Restaurant',
    },
    description: 'Ran out of fuel',
    vehicleInfo: { make: 'Mazda', model: 'CX-5', color: 'Red', plate: 'KDA 012E' },
    price: 500,
    createdAt: '2024-03-31T09:30:00Z',
    updatedAt: '2024-03-31T09:30:00Z',
  },
  {
    id: 'req-005',
    customerId: 'cust-001',
    customerName: 'John Kamau',
    customerPhone: '+254 712 345 678',
    customerAvatar: 'https://ui-avatars.com/api/?name=John+Kamau&background=FF2D2D&color=fff',
    serviceType: 'lockout',
    status: 'completed',
    location: {
      lat: -1.2921,
      lng: 36.8219,
      address: 'Westgate Mall',
      landmark: 'Parking Level 2',
    },
    description: 'Locked keys in car',
    vehicleInfo: { make: 'Toyota', model: 'RAV4', color: 'Blue', plate: 'KAZ 123B' },
    assignedTo: 'mec-002',
    assignedName: 'Michael Kiptoo',
    price: 1500,
    finalPrice: 1500,
    createdAt: '2024-03-25T14:00:00Z',
    updatedAt: '2024-03-25T14:45:00Z',
    completedAt: '2024-03-25T14:45:00Z',
    estimatedArrival: 12,
    rating: 4,
    review: 'Good service but took a bit longer than expected.',
  },
];

// Mock Jobs for Drivers/Mechanics
export const mockJobs: Job[] = [
  {
    id: 'job-001',
    requestId: 'req-002',
    mechanicId: 'mec-001',
    status: 'arrived',
    earnings: 800,
    distance: 3.5,
    pickupLocation: {
      address: 'Karen Shopping Center',
      lat: -1.3001,
      lng: 36.7900,
    },
    customerName: 'Mary Wanjiku',
    customerPhone: '+254 723 456 789',
    serviceType: 'Battery Jumpstart',
    vehicleInfo: 'Honda CR-V (Black)',
    createdAt: '2024-03-31T08:30:00Z',
    acceptedAt: '2024-03-31T08:35:00Z',
  },
  {
    id: 'job-002',
    requestId: 'req-003',
    driverId: 'drv-002',
    status: 'en_route',
    earnings: 1200,
    distance: 5.2,
    pickupLocation: {
      address: 'Uhuru Highway, Near Nyayo Stadium',
      lat: -1.2845,
      lng: 36.8234,
    },
    customerName: 'David Omondi',
    customerPhone: '+254 734 567 890',
    serviceType: 'Tire Change',
    vehicleInfo: 'Nissan X-Trail (White)',
    createdAt: '2024-03-31T09:00:00Z',
    acceptedAt: '2024-03-31T09:10:00Z',
  },
  {
    id: 'job-003',
    requestId: 'req-004',
    status: 'available',
    earnings: 500,
    distance: 7.8,
    pickupLocation: {
      address: 'Langata Road, Near Carnivore',
      lat: -1.3100,
      lng: 36.8100,
    },
    customerName: 'Grace Muthoni',
    customerPhone: '+254 745 678 901',
    serviceType: 'Fuel Delivery',
    vehicleInfo: 'Mazda CX-5 (Red)',
    createdAt: '2024-03-31T09:30:00Z',
  },
  {
    id: 'job-004',
    requestId: 'req-006',
    driverId: 'drv-001',
    status: 'completed',
    earnings: 3500,
    distance: 12.5,
    pickupLocation: {
      address: 'Thika Road, Garden City',
      lat: -1.2300,
      lng: 36.8900,
    },
    destination: {
      address: 'Industrial Area Garage',
      lat: -1.3200,
      lng: 36.8600,
    },
    customerName: 'Robert Kimani',
    customerPhone: '+254 756 789 012',
    serviceType: 'Long Distance Tow',
    vehicleInfo: 'BMW X5 (Black)',
    createdAt: '2024-03-30T16:00:00Z',
    acceptedAt: '2024-03-30T16:05:00Z',
    completedAt: '2024-03-30T17:30:00Z',
  },
];

// Mock Users
export const mockUsers: User[] = [
  {
    id: 'cust-001',
    fullName: 'John Kamau',
    email: 'john@example.com',
    phone: '+254 712 345 678',
    role: 'customer',
    avatarUrl: 'https://ui-avatars.com/api/?name=John+Kamau&background=FF2D2D&color=fff',
    rating: 4.8,
    totalJobs: 12,
  },
  {
    id: 'cust-002',
    fullName: 'Mary Wanjiku',
    email: 'mary@example.com',
    phone: '+254 723 456 789',
    role: 'customer',
    avatarUrl: 'https://ui-avatars.com/api/?name=Mary+Wanjiku&background=f59e0b&color=fff',
    rating: 4.9,
    totalJobs: 5,
  },
  {
    id: 'drv-001',
    fullName: 'Peter Ochieng',
    email: 'peter@example.com',
    phone: '+254 734 567 890',
    role: 'driver',
    avatarUrl: 'https://ui-avatars.com/api/?name=Peter+Ochieng&background=10b981&color=fff',
    rating: 4.9,
    totalJobs: 156,
    earnings: 245000,
    isOnline: true,
    vehicle: { type: 'Tow Truck', plate: 'KCY 123A', model: 'Isuzu FRR' },
    location: { lat: -1.2845, lng: 36.8234, address: 'CBD, Nairobi' },
  },
  {
    id: 'drv-002',
    fullName: 'Alice Akinyi',
    email: 'alice@example.com',
    phone: '+254 745 678 901',
    role: 'driver',
    avatarUrl: 'https://ui-avatars.com/api/?name=Alice+Akinyi&background=10b981&color=fff',
    rating: 4.7,
    totalJobs: 89,
    earnings: 156000,
    isOnline: true,
    vehicle: { type: 'Flatbed', plate: 'KDA 456B', model: 'Mitsubishi Canter' },
    location: { lat: -1.2921, lng: 36.8219, address: 'Westlands, Nairobi' },
  },
  {
    id: 'mec-001',
    fullName: 'James Mwangi',
    email: 'james@example.com',
    phone: '+254 756 789 012',
    role: 'mechanic',
    avatarUrl: 'https://ui-avatars.com/api/?name=James+Mwangi&background=3b82f6&color=fff',
    rating: 4.7,
    totalJobs: 89,
    earnings: 178000,
    isOnline: true,
    location: { lat: -1.3001, lng: 36.7900, address: 'Karen, Nairobi' },
  },
  {
    id: 'mec-002',
    fullName: 'Michael Kiptoo',
    email: 'michael@example.com',
    phone: '+254 767 890 123',
    role: 'mechanic',
    avatarUrl: 'https://ui-avatars.com/api/?name=Michael+Kiptoo&background=3b82f6&color=fff',
    rating: 4.8,
    totalJobs: 67,
    earnings: 134000,
    isOnline: false,
    location: { lat: -1.2845, lng: 36.8234, address: 'CBD, Nairobi' },
  },
  {
    id: 'adm-001',
    fullName: 'Sarah Wanjiku',
    email: 'sarah@example.com',
    phone: '+254 778 901 234',
    role: 'admin',
    avatarUrl: 'https://ui-avatars.com/api/?name=Sarah+Wanjiku&background=8b5cf6&color=fff',
  },
];

// Mock Notifications
export const mockNotifications: Notification[] = [
  {
    id: 'notif-001',
    userId: 'drv-001',
    title: 'New Job Available',
    message: 'A new towing job is available near your location',
    type: 'info',
    read: false,
    createdAt: '2024-03-31T09:00:00Z',
    actionUrl: '/driver/jobs',
  },
  {
    id: 'notif-002',
    userId: 'cust-001',
    title: 'Driver Assigned',
    message: 'Peter Ochieng has been assigned to your request',
    type: 'success',
    read: false,
    createdAt: '2024-03-30T10:05:00Z',
  },
  {
    id: 'notif-003',
    userId: 'mec-001',
    title: 'Payment Received',
    message: 'You received KES 800 for job #job-001',
    type: 'success',
    read: true,
    createdAt: '2024-03-31T08:45:00Z',
  },
  {
    id: 'notif-004',
    userId: 'adm-001',
    title: 'New Driver Registration',
    message: 'A new driver has completed registration and is pending approval',
    type: 'warning',
    read: false,
    createdAt: '2024-03-31T07:30:00Z',
  },
];

// Mock Analytics
export const mockAnalytics: Analytics = {
  totalUsers: 1247,
  totalDrivers: 89,
  totalMechanics: 45,
  totalCustomers: 1113,
  totalRequests: 3456,
  completedRequests: 3120,
  pendingRequests: 23,
  totalRevenue: 8750000,
  driverEarnings: 5200000,
  mechanicEarnings: 2800000,
  platformEarnings: 750000,
  averageRating: 4.7,
  averageResponseTime: 14.5,
};

// Helper functions
export function getServiceTypeLabel(type: string): string {
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

export function getServiceTypeIcon(type: string): string {
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
    available: 'bg-green-500',
    accepted: 'bg-blue-500',
    en_route: 'bg-orange-500',
    arrived: 'bg-purple-500',
  };
  return colors[status] || 'bg-gray-500';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    assigned: 'Assigned',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    available: 'Available',
    accepted: 'Accepted',
    en_route: 'En Route',
    arrived: 'Arrived',
  };
  return labels[status] || status;
}

export function formatCurrency(amount: number): string {
  return `KES ${amount.toLocaleString()}`;
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
