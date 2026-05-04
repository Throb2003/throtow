import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
 
import { supabase } from "@/lib/supabase";
import type {
  AnalyticsSummary,
  AppUser,
  CreateServiceRequestInput,
  Job,
  LocationPoint,
  NotificationRecord,
  PaymentRecord,
  PricingSettings,
  RegisterUserInput,
  RequestMessage,
  ServiceRequest,
  UserRole,
} from "@/types/app";
 
type JsonRecord = Record<string, unknown>;
 
const DEFAULT_ROLE: UserRole = "customer";
 
const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);
 
const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : value == null ? fallback : String(value);
 
const asNullableString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
 
  const normalized = value.trim();
  return normalized ? normalized : undefined;
};
 
const asNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
 
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
 
  return fallback;
};
 
const asBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === "boolean") {
    return value;
  }
 
  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }
 
    if (value === "false") {
      return false;
    }
  }
 
  return fallback;
};
 
const normalizeRole = (value: unknown): UserRole => {
  const role = asString(value).toLowerCase();
 
  if (role === "customer" || role === "driver" || role === "mechanic" || role === "admin") {
    return role;
  }
 
  return DEFAULT_ROLE;
};
 
const toIsoDate = (value: unknown, fallback?: string) => {
  const normalized = asNullableString(value);
  return normalized ?? fallback ?? new Date().toISOString();
};
 
const parseLocation = (value: unknown, fallbackAddress?: string): LocationPoint | null => {
  if (isRecord(value)) {
    const latitude = asNumber(value.lat ?? value.latitude, Number.NaN);
    const longitude = asNumber(value.lng ?? value.longitude, Number.NaN);
 
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return {
        lat: latitude,
        lng: longitude,
        address:
          asNullableString(value.address ?? value.label ?? value.name) ??
          fallbackAddress ??
          `Lat ${latitude}, Lng ${longitude}`,
      } as LocationPoint;
    }
  }
 
  return null;
};
 
const parseRowLocation = (
  row: JsonRecord,
  baseKey: string,
  fallbackAddress?: string,
): LocationPoint | null => {
  const nested = parseLocation(row[baseKey], fallbackAddress);
  if (nested) {
    return nested;
  }
 
  const latitude = asNumber(
    row[`${baseKey}_lat`] ?? row[`${baseKey}Lat`] ?? row[`${baseKey}_latitude`],
    Number.NaN,
  );
  const longitude = asNumber(
    row[`${baseKey}_lng`] ??
      row[`${baseKey}Lng`] ??
      row[`${baseKey}_longitude`] ??
      row[`${baseKey}_lon`],
    Number.NaN,
  );
  const address =
    asNullableString(row[`${baseKey}_address`] ?? row[`${baseKey}Address`]) ?? fallbackAddress;
 
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return {
      lat: latitude,
      lng: longitude,
      address: address ?? `Lat ${latitude}, Lng ${longitude}`,
    } as LocationPoint;
  }
 
  return null;
};
 
const getDisplayNameFromUser = (user: SupabaseAuthUser) => {
  const metadata = isRecord(user.user_metadata) ? user.user_metadata : {};
  const emailName = user.email ? user.email.split("@")[0] : "User";
 
  return (
    asNullableString(
      metadata.full_name ?? metadata.name ?? metadata.fullName ?? metadata.display_name
    ) ?? emailName
  );
};
 
const createProfilePayload = (userId: string, values: JsonRecord) => {
  return {
    id: userId,
    name: asString(values.fullName ?? values.name, "User"),
    email: asString(values.email),
    phone: asString(values.phone),
    role: normalizeRole(values.role),
    avatar_url: asNullableString(values.avatarUrl ?? values.avatar_url ?? values.avatar) ?? null,
    rating: asNumber(values.rating, 0),
    total_jobs: asNumber(values.totalJobs ?? values.total_jobs, 0),
    earnings: asNumber(values.earnings, 0),
    location: isRecord(values.location) ? values.location : null,
    vehicle: isRecord(values.vehicle) ? values.vehicle : null,
    is_online: asBoolean(values.isOnline ?? values.is_online, false),
    updated_at: new Date().toISOString(),
  };
};
 
const mapProfileRow = (row: unknown): AppUser => {
  const record = isRecord(row) ? row : {};
 
  // Parse vehicle as VehicleProfile object
  const vehicleRaw = record.vehicle;
  let vehicle = null;
  if (isRecord(vehicleRaw)) {
    vehicle = {
      type: asString(vehicleRaw.type ?? vehicleRaw.vehicle_type, ""),
      plate: asString(vehicleRaw.plate ?? vehicleRaw.license_plate, ""),
      model: asString(vehicleRaw.model, ""),
    };
  } else if (typeof vehicleRaw === "string" && vehicleRaw.trim()) {
    vehicle = { type: "unknown", plate: "", model: vehicleRaw };
  }
 
  // Parse location as LocationPoint
  const locationRaw = record.location;
  let location = null;
  if (isRecord(locationRaw)) {
    location = parseLocation(locationRaw);
  }
 
  return {
    id: asString(record.id),
    fullName:
      asNullableString(record.name ?? record.full_name ?? record.fullName ?? record.display_name) ||
      asString(record.email).split("@")[0] ||
      "User",
    email: asString(record.email),
    phone: asString(record.phone),
    role: normalizeRole(record.role),
    avatarUrl:
      asNullableString(record.avatar_url ?? record.avatar ?? record.profile_image_url) ?? null,
    rating: asNumber(record.rating, 0),
    totalJobs: asNumber(record.total_jobs ?? record.totalJobs, 0),
    earnings: asNumber(record.earnings, 0),
    isOnline: asBoolean(record.is_online ?? record.isOnline, false),
    location,
    vehicle,
    createdAt: asNullableString(record.created_at ?? record.createdAt),
    updatedAt: asNullableString(record.updated_at ?? record.updatedAt),
  } as AppUser;
};
 
const mapServiceRequestRow = (row: unknown): ServiceRequest => {
  const record = isRecord(row) ? row : {};
 
  const location =
    parseRowLocation(record, "location", asNullableString(record.address ?? record.pickup_address)) ??
    ({
      lat: asNumber(record.lat ?? record.latitude, 0),
      lng: asNumber(record.lng ?? record.longitude, 0),
      address:
        asNullableString(record.address ?? record.location_address) ??
        `Lat ${asNumber(record.lat ?? record.latitude, 0)}, Lng ${asNumber(record.lng ?? record.longitude, 0)}`,
    } as LocationPoint);
 
  const destination =
    parseRowLocation(record, "destination", asNullableString(record.destination_address)) ??
    parseLocation(record.destination) ??
    null;
 
  // Build vehicleInfo as VehicleInfo object
  const vehicleRaw = record.vehicle_info ?? record.vehicleInfo ?? record.vehicle;
  let vehicleInfo: { make: string; model: string; color: string; plate?: string | null };
  if (isRecord(vehicleRaw)) {
    vehicleInfo = {
      make: asString(vehicleRaw.make ?? vehicleRaw.brand, ""),
      model: asString(vehicleRaw.model, ""),
      color: asString(vehicleRaw.color ?? vehicleRaw.colour, ""),
      plate: asNullableString(vehicleRaw.plate ?? vehicleRaw.license_plate) ?? null,
    };
  } else {
    const vehicleStr = asString(vehicleRaw ?? record.vehicle_details, "");
    vehicleInfo = { make: vehicleStr, model: "", color: "", plate: null };
  }
 
  return {
    id: asString(record.id),
    customerId: asString(record.customer_id ?? record.customerId),
    customerName:
      asNullableString(record.customer_name ?? record.customerName) ?? "Customer",
    customerPhone: asNullableString(record.customer_phone ?? record.customerPhone) ?? "",
    customerAvatar: asNullableString(record.customer_avatar ?? record.customerAvatar) ?? null,
    serviceType: asNullableString(record.service_type ?? record.serviceType ?? record.category) ?? "tow",
    description: asString(record.description ?? record.notes),
    status: asString(record.status, "pending") as ServiceRequest["status"],
    location,
    destination,
    vehicleInfo,
    assignedTo: asNullableString(
      record.assigned_to ?? record.assignedTo ?? record.driver_id ?? record.provider_id
    ) ?? null,
    assignedName: asNullableString(record.assigned_name ?? record.assignedName ?? record.provider_name) ?? null,
    price: asNumber(record.price ?? record.amount ?? record.estimated_price, 0),
    finalPrice: asNumber(record.final_price ?? record.finalPrice, 0) || null,
    paymentStatus: asNullableString(record.payment_status ?? record.paymentStatus) as ServiceRequest["paymentStatus"] ?? null,
    paymentMethod: asNullableString(record.payment_method ?? record.paymentMethod) as ServiceRequest["paymentMethod"] ?? null,
    createdAt: toIsoDate(record.created_at ?? record.createdAt),
    updatedAt: toIsoDate(record.updated_at ?? record.updatedAt, toIsoDate(record.created_at)),
    completedAt: asNullableString(record.completed_at ?? record.completedAt) ?? null,
    estimatedArrival: asNumber(record.estimated_arrival ?? record.estimatedArrival, 0) || null,
    rating: asNumber(record.rating, 0) || null,
    review: asNullableString(record.review) ?? null,
    serviceProviderRole: asNullableString(record.provider_role ?? record.providerRole) as ServiceRequest["serviceProviderRole"] ?? null,
  } as ServiceRequest;
};
 
const mapJobRow = (row: unknown): Job => {
  const request = mapServiceRequestRow(row);
  const record = isRecord(row) ? row : {};

  return {
    id: request.id,
    requestId: request.id,
    driverId: asNullableString(record.driver_id ?? record.driverId) ?? null,
    mechanicId: asNullableString(record.mechanic_id ?? record.mechanicId) ?? null,
    status: asString(record.status, "available") as Job["status"],
    earnings: asNumber(record.price ?? record.amount ?? record.earnings, 0),
    distance: asNumber(record.distance ?? record.estimated_distance, 0),
    pickupLocation: request.location,
    destination: request.destination ?? null,
    customerName: request.customerName,
    customerPhone: request.customerPhone,
    serviceType: request.serviceType,
    // ✅ Forward description so driver dialog shows service notes
    description: asNullableString(record.description ?? record.notes) ?? null,
    vehicleInfo: asString(
      isRecord(request.vehicleInfo)
        ? `${request.vehicleInfo.make} ${request.vehicleInfo.model}`.trim()
        : request.vehicleInfo,
      ""
    ),
    createdAt: request.createdAt,
    acceptedAt: asNullableString(record.accepted_at ?? record.acceptedAt) ?? null,
    completedAt: asNullableString(record.completed_at ?? record.completedAt) ?? null,
  } as Job;
};
 
const mapPaymentRow = (row: unknown): PaymentRecord => {
  const record = isRecord(row) ? row : {};
 
  return {
    id: asString(record.id),
    customerId: asString(record.customer_id ?? record.customerId),
    requestId: asString(record.request_id ?? record.requestId),
    amount: asNumber(record.amount, 0),
    currency: asString(record.currency, "KES"),
    phoneNumber:
      asNullableString(record.phone_number ?? record.phoneNumber ?? record.msisdn) ?? "",
    method: asString(record.method ?? record.payment_method, "mpesa"),
    status: asString(record.status, "pending"),
    checkoutRequestId:
      asNullableString(record.checkout_request_id ?? record.checkoutRequestId) ?? undefined,
    merchantRequestId:
      asNullableString(record.merchant_request_id ?? record.merchantRequestId) ?? undefined,
    receiptNumber:
      asNullableString(record.receipt_number ?? record.receiptNumber) ?? undefined,
    createdAt: toIsoDate(record.created_at ?? record.createdAt),
    updatedAt: toIsoDate(record.updated_at ?? record.updatedAt, toIsoDate(record.created_at)),
    paidAt: asNullableString(record.paid_at ?? record.paidAt) ?? undefined,
  } as PaymentRecord;
};
 
const mapNotificationRow = (row: unknown): NotificationRecord => {
  const record = isRecord(row) ? row : {};

  return {
    id: asString(record.id),
    userId: asString(record.user_id ?? record.userId),
    title: asString(record.title),
    message: asString(record.message ?? record.body),
    type: asString(record.type, "info") as NotificationRecord["type"],
    read: asBoolean(record.is_read ?? record.isRead ?? record.read, false),
    createdAt: toIsoDate(record.created_at ?? record.createdAt),
    actionUrl: asNullableString(record.action_url ?? record.actionUrl) ?? null,
  } as NotificationRecord;
};

const mapRequestMessageRow = (row: unknown): RequestMessage => {
  const record = isRecord(row) ? row : {};

  return {
    id: asString(record.id),
    requestId: asString(record.request_id ?? record.requestId),
    senderId: asString(record.sender_id ?? record.senderId),
    senderRole: normalizeRole(record.sender_role ?? record.senderRole),
    senderName: asString(record.sender_name ?? record.senderName, "User"),
    message: asString(record.message, ""),
    createdAt: toIsoDate(record.created_at ?? record.createdAt),
  } as RequestMessage;
};
 
const bootstrapProfileFromAuthUser = async (
  authUser: SupabaseAuthUser,
  fallbackRole?: UserRole,
): Promise<AppUser> => {
  const metadata = isRecord(authUser.user_metadata) ? authUser.user_metadata : {};
  const payload = createProfilePayload(authUser.id, {
    fullName: getDisplayNameFromUser(authUser),
    email: authUser.email ?? "",
    phone: asString(metadata.phone),
    role: fallbackRole ?? normalizeRole(metadata.role),
    avatarUrl: asNullableString(metadata.avatar_url ?? metadata.avatar) ?? "",
    rating: metadata.rating,
    totalJobs: metadata.total_jobs ?? metadata.totalJobs,
    earnings: metadata.earnings,
    location: metadata.location,
    vehicle: metadata.vehicle,
    isOnline: metadata.is_online ?? metadata.isOnline,
  });
 
  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();
 
  if (error) {
    throw new Error(`Unable to create profile for signed-in user: ${error.message}`);
  }
 
  return mapProfileRow(data);
};
 
const getAuthUserOrThrow = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
 
  if (error) {
    throw new Error(`Unable to verify the current user: ${error.message}`);
  }
 
  if (!user) {
    throw new Error("You must be signed in to perform this action.");
  }
 
  return user;
};
 
const getProfileById = async (userId: string, fallbackUser?: SupabaseAuthUser) => {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
 
  if (error) {
    throw new Error(`Unable to load profile: ${error.message}`);
  }
 
  if (data) {
    return mapProfileRow(data);
  }
 
  const authUser = fallbackUser ?? (await getAuthUserOrThrow());
 
  if (authUser.id !== userId) {
    throw new Error("Profile not found for the current user.");
  }
 
  return bootstrapProfileFromAuthUser(authUser);
};
 
const sortByCreatedAtDesc = <T extends { createdAt?: string }>(items: T[]) =>
  [...items].sort((left, right) => {
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
 
    return rightTime - leftTime;
  });
 
export const getCurrentProfile = async (): Promise<AppUser | null> => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
 
  if (error) {
    throw new Error(`Unable to get the current session: ${error.message}`);
  }
 
  if (!session?.user) {
    return null;
  }
 
  return getProfileById(session.user.id, session.user);
};
 
export const signInWithPassword = async (
  email: string,
  password: string,
  role: UserRole,
): Promise<AppUser> => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
 
  if (error) {
    throw new Error(`Unable to sign in: ${error.message}`);
  }
 
  if (!data.user) {
    throw new Error("Sign in did not return a valid user.");
  }
 
  const profile = await getProfileById(data.user.id, data.user);
 
  if (profile.role !== role) {
    await supabase.auth.signOut();
    throw new Error(`This account is registered as ${profile.role}, not ${role}.`);
  }
 
  return profile;
};
 
export const signUpWithProfile = async (input: RegisterUserInput): Promise<AppUser | null> => {
  const values = input as unknown as JsonRecord;
  const email = asString(values.email).trim();
  const password = asString(values.password);
 
  if (!email || !password) {
    throw new Error("Email and password are required to create an account.");
  }
 
  const role = normalizeRole(values.role);
  const fullName = asString(values.fullName ?? values.name, email.split("@")[0] || "User");
  const phone = asString(values.phone);
 
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: fullName,
        full_name: fullName,
        phone,
        role,
        avatar_url: asNullableString(values.avatarUrl ?? values.avatar) ?? undefined,
      },
    },
  });
 
  if (error) {
    throw new Error(`Unable to register user: ${error.message}`);
  }
 
  if (!data.user) {
    return null;
  }
 
  try {
    return await bootstrapProfileFromAuthUser(data.user, role);
  } catch (profileError) {
    if (!data.session) {
      return null;
    }
 
    throw profileError;
  }
};
 
export const signOutUser = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut();
 
  if (error) {
    throw new Error(`Unable to sign out: ${error.message}`);
  }
};
 
export const updateProfile = async (updates: Partial<AppUser>): Promise<AppUser> => {
  const authUser = await getAuthUserOrThrow();
  const existingProfile = await getProfileById(authUser.id, authUser);
  const mergedProfile = {
    ...existingProfile,
    ...updates,
    email: updates.email ?? existingProfile.email ?? authUser.email ?? "",
    fullName: updates.fullName ?? existingProfile.fullName ?? getDisplayNameFromUser(authUser),
    role: updates.role ?? existingProfile.role ?? DEFAULT_ROLE,
  } as AppUser;
  const payload = createProfilePayload(authUser.id, mergedProfile as unknown as JsonRecord);
 
  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();
 
  if (error) {
    throw new Error(`Unable to update profile: ${error.message}`);
  }
 
  return mapProfileRow(data);
};
 
export const setAvailability = async (isOnline: boolean): Promise<AppUser> =>
  updateProfile({ isOnline } as Partial<AppUser>);
 
export const listCustomerRequests = async (customerId: string): Promise<ServiceRequest[]> => {
  const { data, error } = await supabase
    .from("service_requests")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
 
  if (error) {
    throw new Error(`Unable to load customer requests: ${error.message}`);
  }
 
  return (data ?? []).map(mapServiceRequestRow);
};
 
export const createCustomerRequest = async (
  customerId: string,
  input: CreateServiceRequestInput,
): Promise<ServiceRequest> => {
  const values = input as unknown as JsonRecord;
  const location = parseLocation(values.location);
  const destination = parseLocation(values.destination);
 
  // Merge notes into description so drivers always see the full context
  const baseDescription = asString(values.description ?? values.issueDescription ?? values.issue_description);
  const extraNotes = asString(values.notes ?? values.additionalNotes ?? values.additional_notes);
  const fullDescription = extraNotes
    ? baseDescription
      ? `${baseDescription}\n\nAdditional notes: ${extraNotes}`
      : extraNotes
    : baseDescription;

  // Vehicle info — build a structured object from whatever the customer provided
  const vehicleStr = asString(
    values.vehicleDetails ?? values.vehicle_details ?? values.vehicleInfo ?? values.vehicle_info,
  );
  const vehicleInfo = vehicleStr
    ? { make: vehicleStr, model: "", color: "", plate: null }
    : null;

  // Customer contact phone from the form
  const customerPhone = asString(
    values.contactPhone ?? values.customerPhone ?? values.phoneNumber ?? values.phone,
  );

  const insertPayload = {
    customer_id: customerId,
    service_type: asString(values.serviceType ?? values.service_type, "General"),
    description: fullDescription,
    notes: extraNotes || null,
    vehicle_info: vehicleInfo,
    customer_phone: customerPhone || null,
    priority: asString(values.priority ?? values.urgency, "normal"),
    status: "pending",
    payment_status: "unpaid",
    price: asNumber(values.price ?? values.estimatedPrice, 0),
    location: location
      ? {
          lat: location.lat,
          lng: location.lng,
          address: location.address,
        }
      : null,
    destination: destination
      ? {
          lat: destination.lat,
          lng: destination.lng,
          address: destination.address,
        }
      : null,
  };
 
  const { data, error } = await supabase
    .from("service_requests")
    .insert(insertPayload)
    .select("*")
    .single();
 
  if (error) {
    throw new Error(`Unable to create service request: ${error.message}`);
  }
 
  return mapServiceRequestRow(data);
};
 
export const listAvailableJobs = async (
  role: Extract<UserRole, "driver" | "mechanic">,
): Promise<Job[]> => {
  const { data, error } = await supabase
    .from("service_requests")
    .select("*")
    .in("status", ["pending", "open", "requested"])
    .order("created_at", { ascending: false });
 
  if (error) {
    throw new Error(`Unable to load available ${role} jobs: ${error.message}`);
  }
 
  return (data ?? [])
    .filter((row) => {
      const record = isRecord(row) ? row : {};
      const providerRole = asNullableString(record.provider_role ?? record.providerRole);
      const assignedProvider =
        asNullableString(
          record.provider_id ??
            record.providerId ??
            record.driver_id ??
            record.driverId ??
            record.mechanic_id ??
            record.mechanicId,
        ) ?? null;
 
      return (!providerRole || providerRole === role) && !assignedProvider;
    })
    .map(mapJobRow);
};
 
export const listMyJobs = async (
  userId: string,
  role: Extract<UserRole, "driver" | "mechanic">,
): Promise<Job[]> => {
  const { data, error } = await supabase
    .from("service_requests")
    .select("*")
    .or(`provider_id.eq.${userId},driver_id.eq.${userId},mechanic_id.eq.${userId}`)
    .order("created_at", { ascending: false });
 
  if (error) {
    throw new Error(`Unable to load ${role} jobs: ${error.message}`);
  }
 
  return (data ?? [])
    .filter((row) => {
      const record = isRecord(row) ? row : {};
      const providerRole = asNullableString(record.provider_role ?? record.providerRole);
 
      if (!providerRole) {
        return true;
      }
 
      return providerRole === role;
    })
    .map(mapJobRow);
};
 
export const listPayments = async (customerId: string): Promise<PaymentRecord[]> => {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
 
  if (error) {
    throw new Error(`Unable to load payments: ${error.message}`);
  }
 
  return (data ?? []).map(mapPaymentRow);
};
 
export const listNotifications = async (
  userId: string,
): Promise<NotificationRecord[]> => {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
 
  if (error) {
    throw new Error(`Unable to load notifications: ${error.message}`);
  }
 
  return (data ?? []).map(mapNotificationRow);
};
 
export const markNotificationRead = async (notificationId: string): Promise<void> => {
  const { error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId);

  if (error) {
    throw new Error(`Unable to mark notification as read: ${error.message}`);
  }
};

export const listRequestMessages = async (requestId: string): Promise<RequestMessage[]> => {
  const { data, error } = await supabase
    .from("request_messages")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Unable to load chat messages: ${error.message}`);
  }

  return (data ?? []).map(mapRequestMessageRow);
};

export const sendRequestMessage = async (
  requestId: string,
  message: string,
): Promise<RequestMessage> => {
  const body = message.trim();

  if (!body) {
    throw new Error("Message cannot be empty.");
  }

  const profile = await getCurrentProfile();

  if (!profile) {
    throw new Error("You must be signed in to send a message.");
  }

  const { data, error } = await supabase
    .from("request_messages")
    .insert({
      request_id: requestId,
      sender_id: profile.id,
      sender_role: profile.role,
      sender_name: profile.fullName,
      message: body,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Unable to send chat message: ${error.message}`);
  }

  return mapRequestMessageRow(data);
};

export const getAdminAnalytics = async (): Promise<AnalyticsSummary> => {
  const [requestsResult, paymentsResult, usersResult] = await Promise.all([
    supabase.from("service_requests").select("*"),
    supabase.from("payments").select("*"),
    supabase.from("profiles").select("*"),
  ]);
 
  if (requestsResult.error) {
    throw new Error(`Unable to load request analytics: ${requestsResult.error.message}`);
  }
 
  if (paymentsResult.error) {
    throw new Error(`Unable to load payment analytics: ${paymentsResult.error.message}`);
  }
 
  if (usersResult.error) {
    throw new Error(`Unable to load user analytics: ${usersResult.error.message}`);
  }
 
  const requests = (requestsResult.data ?? []).map(mapServiceRequestRow);
  const payments = (paymentsResult.data ?? []).map(mapPaymentRow);
  const users = (usersResult.data ?? []).map(mapProfileRow);
 
  const completedRequests = requests.filter((r) => r.status === "completed");
  const pendingRequests = requests.filter((r) =>
    ["pending", "open", "requested"].includes(r.status),
  );
  const successfulPayments = payments.filter((p) => p.status === "paid");
  const drivers = users.filter((u) => u.role === "driver");
  const mechanics = users.filter((u) => u.role === "mechanic");
  const customers = users.filter((u) => u.role === "customer");
  const totalRevenue = successfulPayments.reduce((sum, p) => sum + p.amount, 0);
 
  return {
    totalUsers: users.length,
    totalDrivers: drivers.length,
    totalMechanics: mechanics.length,
    totalCustomers: customers.length,
    totalRequests: requests.length,
    completedRequests: completedRequests.length,
    pendingRequests: pendingRequests.length,
    totalRevenue,
    driverEarnings: totalRevenue * 0.85,
    mechanicEarnings: 0,
    platformEarnings: totalRevenue * 0.15,
    averageRating: 0,
    averageResponseTime: 0,
  } as AnalyticsSummary;
};
 
export const getAdminUsers = async (): Promise<AppUser[]> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("name", { ascending: true });
 
  if (error) {
    throw new Error(`Unable to load users: ${error.message}`);
  }
 
  return (data ?? []).map(mapProfileRow);
};
 
export const listAllRequests = async (): Promise<ServiceRequest[]> => {
  const { data, error } = await supabase
    .from("service_requests")
    .select("*")
    .order("created_at", { ascending: false });
 
  if (error) {
    throw new Error(`Unable to load all requests: ${error.message}`);
  }
 
  return sortByCreatedAtDesc((data ?? []).map(mapServiceRequestRow));
};
 
export const getPricingSettings = async (): Promise<PricingSettings> => {
  const { data, error } = await supabase
    .from("pricing_settings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
 
  if (error) {
    throw new Error(`Unable to load pricing settings: ${error.message}`);
  }
 
  const record = isRecord(data) ? data : {};
 
  return {
    towBaseRate: asNumber(record.tow_base_rate ?? record.towBaseRate ?? record.base_price, 2500),
    towRatePerKm: asNumber(record.tow_rate_per_km ?? record.towRatePerKm ?? record.price_per_km, 300),
    batteryJumpstartRate: asNumber(record.battery_jumpstart_rate ?? record.batteryJumpstartRate, 800),
    tireChangeRate: asNumber(record.tire_change_rate ?? record.tireChangeRate, 1200),
    fuelDeliveryRate: asNumber(record.fuel_delivery_rate ?? record.fuelDeliveryRate, 500),
    lockoutRate: asNumber(record.lockout_rate ?? record.lockoutRate, 1500),
    mechanicInspectionRate: asNumber(record.mechanic_inspection_rate ?? record.mechanicInspectionRate, 1800),
    driverCommissionPercent: asNumber(record.driver_commission_percent ?? record.driverCommissionPercent, 15),
    mechanicCommissionPercent: asNumber(record.mechanic_commission_percent ?? record.mechanicCommissionPercent, 15),
  } as PricingSettings;
};
 
export const acceptJob = async (jobId: string, driverId: string): Promise<void> => {
  const { error } = await supabase
    .from("service_requests")
    .update({
      status: "accepted",
      driver_id: driverId,
      provider_id: driverId,
      provider_role: "driver",
      assigned_to: driverId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
 
  if (error) throw new Error(`Unable to accept job: ${error.message}`);
 
  // Get the request to find the customer
  const { data: request } = await supabase
    .from("service_requests")
    .select("customer_id")
    .eq("id", jobId)
    .single();
 
  if (request?.customer_id) {
    await supabase.from("notifications").insert({
      user_id: request.customer_id,
      title: "Driver accepted your request!",
      message: "A driver has accepted your service request and is on the way.",
      type: "success",
      related_id: jobId,
    });
  }
};
 
export const declineJob = async (jobId: string): Promise<void> => {
  // Get customer info BEFORE changing anything
  const { data: request } = await supabase
    .from("service_requests")
    .select("customer_id, service_type")
    .eq("id", jobId)
    .single();
 
  // Put job back to pending so other drivers can see it
  const { error } = await supabase
    .from("service_requests")
    .update({
      status: "pending",
      driver_id: null,
      provider_id: null,
      provider_role: null,
      assigned_to: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
 
  if (error) throw new Error(`Unable to decline job: ${error.message}`);
 
  // Notify the customer their request is back in queue
  if (request?.customer_id) {
    const serviceType = request.service_type ?? "service";
    await supabase.from("notifications").insert({
      user_id: request.customer_id,
      title: "Driver declined your request",
      message: `A driver was unable to take your ${serviceType} request. Don't worry — your request is still active and visible to other nearby drivers!`,
      type: "warning",
      related_id: jobId,
    });
  }
};
 
export const cancelJob = async (jobId: string): Promise<void> => {
  // Get customer + driver info BEFORE changing anything
  const { data: request } = await supabase
    .from("service_requests")
    .select("customer_id, service_type, driver_id")
    .eq("id", jobId)
    .single();
 
  // Release job back to pending so other drivers can pick it up
  const { error } = await supabase
    .from("service_requests")
    .update({
      status: "pending",
      driver_id: null,
      provider_id: null,
      provider_role: null,
      assigned_to: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
 
  if (error) throw new Error(`Unable to cancel job: ${error.message}`);
 
  // Notify the customer
  if (request?.customer_id) {
    const serviceType = request.service_type ?? "service";
    await supabase.from("notifications").insert({
      user_id: request.customer_id,
      title: "Your driver cancelled",
      message: `Your driver cancelled your ${serviceType} request. No worries — your request is back in the queue and other nearby drivers can now see and accept it!`,
      type: "warning",
      related_id: jobId,
    });
  }
};
 
export const completeJob = async (jobId: string, finalPrice?: number): Promise<void> => {
  // Fetch full request details — customer, price, service type
  const { data: request, error: fetchError } = await supabase
    .from("service_requests")
    .select("customer_id, service_type, price, amount, estimated_price, driver_id, mechanic_id, provider_id")
    .eq("id", jobId)
    .single();

  if (fetchError) throw new Error(`Unable to fetch job for completion: ${fetchError.message}`);

  const now = new Date().toISOString();
  const record = isRecord(request) ? request : {};
  const storedPrice = asNumber(record.price ?? record.amount ?? record.estimated_price, 0);
  // Use the driver-calculated price if provided and stored is 0
  const price = finalPrice && finalPrice > 0 ? finalPrice : storedPrice;



  // Mark the request as completed and save the final price
  const { error } = await supabase
    .from("service_requests")
    .update({
      status: "completed",
      payment_status: "pending",
      price: price,
      completed_at: now,
      updated_at: now,
    })
    .eq("id", jobId);

  if (error) throw new Error(`Unable to complete job: ${error.message}`);

  const customerId = asNullableString(record.customer_id);
  const serviceType = asString(record.service_type, "service");
  const priceFormatted = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(price);

  // Notify the customer — prompt them to pay (like Uber/Bolt receipt)
  if (customerId) {
    await supabase.from("notifications").insert({
      user_id: customerId,
      title: "Service complete — payment due",
      message: price > 0
        ? `Your ${serviceType} service has been completed. Your total is ${priceFormatted}. Please proceed to payment in your dashboard.`
        : `Your ${serviceType} service has been completed. Please proceed to the Payments section to settle your balance.`,
      type: "success",
      related_id: jobId,
    });
  }

  // Notify the driver/mechanic that the job is done and shows their earnings
  const providerId = asNullableString(
    record.driver_id ?? record.mechanic_id ?? record.provider_id,
  );
  if (providerId) {
    await supabase.from("notifications").insert({
      user_id: providerId,
      title: "Job marked complete",
      message: price > 0
        ? `You have completed the ${serviceType} job. Your earnings of ${priceFormatted} will be reflected in your dashboard.`
        : `You have completed the ${serviceType} job. Earnings will be updated once payment is confirmed.`,
      type: "success",
      related_id: jobId,
    });
  }
};


// ─── Mark driver as arrived at customer location ──────────────────────────────
export const markDriverArrived = async (jobId: string): Promise<void> => {
  const { data: request, error: fetchError } = await supabase
    .from("service_requests")
    .select("customer_id, service_type, driver_id, mechanic_id, provider_id")
    .eq("id", jobId)
    .single();

  if (fetchError) throw new Error(`Unable to fetch job: ${fetchError.message}`);

  const { error } = await supabase
    .from("service_requests")
    .update({
      status: "arrived",
      arrived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) throw new Error(`Unable to mark arrived: ${error.message}`);

  const record = isRecord(request) ? request : {};
  const customerId = asNullableString(record.customer_id);
  const serviceType = asString(record.service_type, "service");

  // Notify the customer their driver/mechanic has arrived
  if (customerId) {
    await supabase.from("notifications").insert({
      user_id: customerId,
      title: "Your driver has arrived! 🚗",
      message: `Your ${serviceType} provider has arrived at your location. Please meet them within 10 minutes to begin the service.`,
      type: "info",
      related_id: jobId,
    });
  }
};

// ─── Start the trip/service ───────────────────────────────────────────────────
export const startTrip = async (jobId: string): Promise<void> => {
  const { data: request, error: fetchError } = await supabase
    .from("service_requests")
    .select("customer_id, service_type, driver_id, mechanic_id, provider_id")
    .eq("id", jobId)
    .single();

  if (fetchError) throw new Error(`Unable to fetch job: ${fetchError.message}`);

  const { error } = await supabase
    .from("service_requests")
    .update({
      status: "in_progress",
      trip_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) throw new Error(`Unable to start trip: ${error.message}`);

  const record = isRecord(request) ? request : {};
  const customerId = asNullableString(record.customer_id);
  const serviceType = asString(record.service_type, "service");

  // Notify the customer their trip has started
  if (customerId) {
    await supabase.from("notifications").insert({
      user_id: customerId,
      title: "Trip started! 🚀",
      message: `Your ${serviceType} is now in progress. You can track your driver live on the map.`,
      type: "info",
      related_id: jobId,
    });
  }
};

export const cancelCustomerRequest = async (requestId: string): Promise<void> => {
  // Get the driver info BEFORE cancelling so we can notify them
  const { data: request } = await supabase
    .from("service_requests")
    .select("driver_id, mechanic_id, provider_id, service_type, customer_id")
    .eq("id", requestId)
    .single();
 
  // Cancel the request
  const { error } = await supabase
    .from("service_requests")
    .update({
      status: "cancelled",
      payment_status: "cancelled",
      driver_id: null,
      provider_id: null,
      provider_role: null,
      assigned_to: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);
 
  if (error) throw new Error(`Unable to cancel service request: ${error.message}`);
 
  // Find who was assigned — driver, mechanic, or provider
  const assignedUserId =
    request?.driver_id ??
    request?.mechanic_id ??
    request?.provider_id ??
    null;
 
  // Notify the assigned driver/mechanic if there was one
  if (assignedUserId) {
    const serviceType = request?.service_type ?? "service";
    await supabase.from("notifications").insert({
      user_id: assignedUserId,
      title: "Customer cancelled the request",
      message: `The customer cancelled their ${serviceType} request. This job has been removed from your active queue.`,
      type: "info",
      related_id: requestId,
    });
  }
};
 
// ─────────────────────────────────────────────────────────────────────────────
// LIVE DRIVER LOCATION TRACKING
// ─────────────────────────────────────────────────────────────────────────────
 
/**
 * Called by the DRIVER every few seconds to push their GPS position to Supabase.
 * Supabase Realtime broadcasts the change instantly to the customer.
 */
export const updateDriverLocation = async (
  driverId: string,
  requestId: string,
  lat: number,
  lng: number,
): Promise<void> => {
  const { error } = await supabase
    .from("driver_locations")
    .upsert(
      {
        driver_id: driverId,
        request_id: requestId,
        lat,
        lng,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "driver_id,request_id" },
    );
 
  if (error) throw new Error(`Unable to update driver location: ${error.message}`);
};
 
/**
 * Called by the CUSTOMER to get where the driver currently is.
 */
export const getDriverLocation = async (
  driverId: string,
  requestId: string,
): Promise<{ lat: number; lng: number } | null> => {
  const { data, error } = await supabase
    .from("driver_locations")
    .select("lat, lng")
    .eq("driver_id", driverId)
    .eq("request_id", requestId)
    .maybeSingle();
 
  if (error) return null;
  if (!data) return null;
 
  return {
    lat: Number(data.lat),
    lng: Number(data.lng),
  };
};
 
/**
 * Clean up driver location when job is done or cancelled.
 */
export const clearDriverLocation = async (
  driverId: string,
  requestId: string,
): Promise<void> => {
  await supabase
    .from("driver_locations")
    .delete()
    .eq("driver_id", driverId)
    .eq("request_id", requestId);
};
 
export const getProviderStatus = async (): Promise<{
  isOnline: boolean;
  isOnJob: boolean;
  currentJobId: string | null;
} | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("is_online, current_job_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return null;

 const record: Record<string, unknown> = isRecord(data) ? data : {};

  return {
    isOnline: asBoolean(record.is_online, false),
    isOnJob: Boolean(record.current_job_id),
    currentJobId: asNullableString(record.current_job_id) ?? null,
  };
};

export const setOnlineStatus = async (online: boolean): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({
      is_online: online,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) throw new Error(`Unable to update online status: ${error.message}`);
};

export const updateProviderLocation = async (location: LocationPoint): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({
      location: { lat: location.lat, lng: location.lng, address: location.address ?? null },
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) throw new Error(`Unable to update provider location: ${error.message}`);
};

// ─────────────────────────────────────────────────────────────────────────────
// PRICING SETTINGS — Add these two functions to the BOTTOM of supabaseData.ts
// right after the existing getPricingSettings function
// ─────────────────────────────────────────────────────────────────────────────

export const updatePricingSettings = async (
  settings: PricingSettings,
): Promise<PricingSettings> => {
  // Get the current admin user
  const authUser = await getAuthUserOrThrow();

  // Check there is an existing row to update
  const { data: existing, error: fetchError } = await supabase
    .from("pricing_settings")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Unable to fetch pricing settings: ${fetchError.message}`);
  }

  const payload = {
    tow_base_rate:              settings.towBaseRate,
    tow_rate_per_km:            settings.towRatePerKm,
    battery_jumpstart_rate:     settings.batteryJumpstartRate,
    tire_change_rate:           settings.tireChangeRate,
    fuel_delivery_rate:         settings.fuelDeliveryRate,
    lockout_rate:               settings.lockoutRate,
    mechanic_inspection_rate:   settings.mechanicInspectionRate,
    driver_commission_percent:  settings.driverCommissionPercent,
    mechanic_commission_percent: settings.mechanicCommissionPercent,
    updated_by:                 authUser.id,
    updated_at:                 new Date().toISOString(),
  };

  let result;

  if (existing?.id) {
    // Update the existing row
    const { data, error } = await supabase
      .from("pricing_settings")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw new Error(`Unable to update pricing settings: ${error.message}`);
    result = data;
  } else {
    // No row exists yet — insert one
    const { data, error } = await supabase
      .from("pricing_settings")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw new Error(`Unable to create pricing settings: ${error.message}`);
    result = data;
  }

  // Map the saved row back to PricingSettings shape
  const record = isRecord(result) ? result : {};

  return {
    towBaseRate:              asNumber(record.tow_base_rate, 2500),
    towRatePerKm:             asNumber(record.tow_rate_per_km, 300),
    batteryJumpstartRate:     asNumber(record.battery_jumpstart_rate, 800),
    tireChangeRate:           asNumber(record.tire_change_rate, 1200),
    fuelDeliveryRate:         asNumber(record.fuel_delivery_rate, 500),
    lockoutRate:              asNumber(record.lockout_rate, 1500),
    mechanicInspectionRate:   asNumber(record.mechanic_inspection_rate, 1800),
    driverCommissionPercent:  asNumber(record.driver_commission_percent, 15),
    mechanicCommissionPercent: asNumber(record.mechanic_commission_percent, 15),
  } as PricingSettings;
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ONLINE STATUS
// Call this right after admin logs in to force is_online = true
// ─────────────────────────────────────────────────────────────────────────────

export const setAdminOnline = async (): Promise<void> => {
  const authUser = await getAuthUserOrThrow();

  const { error } = await supabase
    .from("profiles")
    .update({
      is_online: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", authUser.id);

  if (error) throw new Error(`Unable to set admin online: ${error.message}`);
};

export const setUserOnlineStatus = async (
  userId: string,
  isOnline: boolean,
): Promise<void> => {
  await supabase
    .from("profiles")
    .update({
      is_online: isOnline,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
};