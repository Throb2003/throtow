/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/lib/supabase";
import {
  getCurrentProfile,
  getProviderStatus,
  setAdminOnline,
  setOnlineStatus,
  signInWithPassword,
  signOutUser,
  signUpWithProfile,
  updateProfile,
  updateProviderLocation,
} from "@/services/supabaseData";
import type {
  AppUser,
  LocationPoint,
  RegisterUserInput,
  UserRole as DomainUserRole,
  VehicleProfile,
} from "@/types/app";

export type UserRole = DomainUserRole;
export type User = AppUser;

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isOnline: boolean;
  isOnJob: boolean;
  currentJobId: string | null;
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  register: (userData: RegisterFormInput) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  setUserRole: (role: UserRole) => void;
  setOnline: (online: boolean) => Promise<void>;
  updateLocation: (location: LocationPoint) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type ProfileInput = Partial<AppUser> & {
  name?: string | null;
  avatar?: string | null;
  location?: LocationPoint | string | null;
  vehicle?: VehicleProfile | string | null;
};

type RegisterFormInput = {
  fullName?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
  location?: LocationPoint | string | null;
  vehicle?: VehicleProfile | string | null;
  role?: Exclude<UserRole, "admin">;
  password: string;
};

const normalizeUser = (user: ProfileInput): User => {
  const fullName = user.fullName ?? user.name ?? user.email?.split("@")[0] ?? "User";
  const avatarUrl = user.avatarUrl ?? user.avatar ?? null;

  return {
    id: user.id ?? "",
    fullName,
    email: user.email ?? "",
    phone: user.phone ?? "",
    role: user.role ?? "customer",
    avatarUrl,
    rating: user.rating ?? 0,
    totalJobs: user.totalJobs ?? 0,
    earnings: user.earnings ?? 0,
    isOnline: user.isOnline ?? false,
    location:
      user.location && typeof user.location === "object" && "lat" in user.location
        ? user.location
        : null,
    vehicle:
      user.vehicle && typeof user.vehicle === "object" && "type" in user.vehicle
        ? user.vehicle
        : null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [isOnJob, setIsOnJob] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const loadCurrentUser = useCallback(async () => {
    try {
      const profile = await getCurrentProfile();
      setUser(profile ? normalizeUser(profile) : null);

      if (profile && (profile.role === "driver" || profile.role === "mechanic")) {
        const status = await getProviderStatus();

        if (status) {
          setIsOnline(status.isOnline);
          setIsOnJob(status.isOnJob);
          setCurrentJobId(status.currentJobId);
          return;
        }
      }

      setIsOnline(false);
      setIsOnJob(false);
      setCurrentJobId(null);
    } catch (error) {
      console.error("Failed to load authenticated profile:", error);
      setUser(null);
      setIsOnline(false);
      setIsOnJob(false);
      setCurrentJobId(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      await loadCurrentUser();
      if (cancelled) {
        return;
      }
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadCurrentUser();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadCurrentUser]);

 const login = useCallback(
  async (email: string, password: string, role: UserRole) => {
    const profile = await signInWithPassword(email, password, role);
    setUser(normalizeUser(profile));

    if (profile.role === "admin") {
      try {
        await setAdminOnline();
        setIsOnline(true);
      } catch (err) {
        console.warn("Could not set admin online status:", err);
      }
    }
  },
  [],
);

  const register = useCallback(async (userData: RegisterFormInput) => {
    const role: RegisterUserInput["role"] = userData.role ?? "customer";

    const input: RegisterUserInput = {
      fullName: userData.fullName ?? userData.name ?? "",
      email: userData.email ?? "",
      phone: userData.phone ?? "",
      role,
      password: userData.password,
    };

    const profile = await signUpWithProfile(input);

    if (profile) {
      setUser(normalizeUser(profile as ProfileInput));
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setIsOnline(false);
    setIsOnJob(false);
    setCurrentJobId(null);

    void signOutUser().catch((error) => {
      console.error("Failed to sign out:", error);
    });
  }, []);

  const updateUserState = useCallback((updates: Partial<User>) => {
    setUser((currentUser) => {
      if (!currentUser) {
        return currentUser;
      }

      return normalizeUser({
        ...currentUser,
        ...updates,
      } as User);
    });
  }, []);

  const updateUserDetails = useCallback(
    (updates: Partial<User>) => {
      let previousUser: User | null = null;

      setUser((currentUser) => {
        previousUser = currentUser;

        if (!currentUser) {
          return currentUser;
        }

        return normalizeUser({
          ...currentUser,
          ...updates,
        } as User);
      });

      void updateProfile(updates).catch((error) => {
        console.error("Failed to persist profile update:", error);

        setUser((currentUser) => {
          if (!currentUser || !previousUser) {
            return currentUser;
          }

          return previousUser;
        });
      });
    },
    [],
  );

  const setUserRole = useCallback(
    (role: UserRole) => {
      updateUserState({ role });
      void updateProfile({ role }).catch((error) => {
        console.error("Failed to update user role:", error);
        void loadCurrentUser();
      });
    },
    [loadCurrentUser, updateUserState],
  );

  const setOnline = useCallback(
    async (online: boolean) => {
      try {
        await setOnlineStatus(online);
        setIsOnline(online);
        if (!online) {
          setIsOnJob(false);
          setCurrentJobId(null);
        }
      } catch (error) {
        console.error("Failed to set online status:", error);
        throw error;
      }
    },
    [],
  );

  const updateLocation = useCallback(
    async (location: LocationPoint) => {
      try {
        await updateProviderLocation(location);
      } catch (error) {
        console.error("Failed to update location:", error);
        throw error;
      }
    },
    [],
  );

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isOnline,
      isOnJob,
      currentJobId,
      login,
      register,
      logout,
      updateUser: updateUserDetails,
      setUserRole,
      setOnline,
      updateLocation,
    }),
    [
      user,
      isOnline,
      isOnJob,
      currentJobId,
      login,
      register,
      logout,
      updateUserDetails,
      setUserRole,
      setOnline,
      updateLocation,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
