"use client";

import { createContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { User } from "@/types";
import * as api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { jwtDecode } from "jwt-decode";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  register: (
    username: string,
    password: string,
    role?: "admin" | "manager" | "visitor"
  ) => Promise<void>;
  changePassword: (password: string) => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

interface DecodedToken {
  sub: string; // User ID
  role: "admin" | "manager" | "visitor";
  iat: number;
  exp: number;
}

const decodeToken = (
  token: string
): Omit<User, "username" | "status"> | null => {
  try {
    const decoded: DecodedToken = jwtDecode(token);
    // Ensure 'sub' is a valid number before parsing
    const userId = Number(decoded.sub);
    if (isNaN(userId)) {
      console.error("Invalid user ID in token:", decoded.sub);
      return null;
    }
    return {
      id: userId,
      role: decoded.role,
    };
  } catch (error) {
    console.error("Failed to decode token:", error);
    return null;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const fetchAndSetUser = async (
    token: string,
    storedUsername?: string | null
  ) => {
    const userDataFromToken = decodeToken(token);
    if (!userDataFromToken) {
      logout();
      return;
    }

    // Role-based data fetching
    if (userDataFromToken.role === "admin") {
      try {
        const allUsers = await api.getUsers();
        const currentUserData = allUsers.find(
          (u) => u.id === userDataFromToken.id
        );
        if (currentUserData) {
          if (currentUserData.status !== "approved") {
            logout();
            toast({
              title: "Access Denied",
              description: `Your account status is '${currentUserData.status}'.`,
              variant: "destructive",
            });
          } else {
            setUser(currentUserData);
          }
        } else {
          logout(); // User not found in db
        }
      } catch (error: any) {
        console.error("Could not fetch user data for admin", error);
        logout();
      }
    } else {
      // For 'visitor' or 'manager' role
      if (storedUsername) {
        // For visitors/managers, we can't fetch from /users.
        // We construct the user object from the token and stored username.
        // If login was successful, we assume status is 'approved'.
        const nonAdminUser: User = {
          id: userDataFromToken.id,
          role: userDataFromToken.role,
          username: storedUsername,
          status: "approved",
        };
        setUser(nonAdminUser);
      } else {
        // Not enough info to build user object
        logout();
      }
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      setLoading(true);
      const token = localStorage.getItem("access_token");
      const username = localStorage.getItem("username");
      if (token && username) {
        await fetchAndSetUser(token, username);
      }
      setLoading(false);
    };
    checkUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await api.login(username, password);
      const token = response.access_token;
      localStorage.setItem("access_token", token);
      localStorage.setItem("username", username); // Store username for non-admin retrieval

      await fetchAndSetUser(token, username);

      router.push("/dashboard");
      toast({ title: "Login Successful", description: "Welcome back!" });
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const register = async (
    username: string,
    password: string,
    role: "admin" | "manager" | "visitor" = "visitor"
  ) => {
    try {
      await api.register(username, password, role);
      toast({
        title: "Registration Successful",
        description:
          "Your account has been created and is awaiting admin approval.",
      });
      router.push("/login");
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("username");
    setUser(null);
    router.push("/login");
  };

  const changePassword = async (password: string) => {
    try {
      await api.changePassword(password);
      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully.",
      });
      return true;
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, register, changePassword }}
    >
      {children}
    </AuthContext.Provider>
  );
};
