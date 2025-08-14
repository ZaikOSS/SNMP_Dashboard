
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
  register: (username: string, password: string, role?: 'admin' | 'visitor') => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

interface DecodedToken {
  sub: string; // User ID
  role: 'admin' | 'visitor';
  iat: number;
  exp: number;
}

const decodeToken = (token: string): Omit<User, 'username'> | null => {
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

  useEffect(() => {
    try {
      const token = localStorage.getItem("access_token");
      const username = localStorage.getItem("username");
      if (token && username) {
        const userData = decodeToken(token);
        if (userData) {
          setUser({...userData, username});
        } else {
            // Token is invalid or expired
            localStorage.removeItem("access_token");
            localStorage.removeItem("username");
        }
      }
    } catch (error) {
        console.error("Could not process token from local storage", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await api.login(username, password);
      const token = response.access_token;
      localStorage.setItem("access_token", token);
      localStorage.setItem("username", username); // Store username separately
      const userData = decodeToken(token);
      if (userData) {
        setUser({ ...userData, username });
      }
      router.push("/dashboard");
      toast({ title: "Login Successful", description: "Welcome back!" });
    } catch (error: any) {
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
    }
  };

  const register = async (username: string, password: string, role: 'admin' | 'visitor' = 'visitor') => {
     try {
        await api.register(username, password, role);
        toast({ title: "Registration Successful", description: "You can now log in with your new account." });
        router.push("/login");
     } catch (error: any) {
        toast({ title: "Registration Failed", description: error.message, variant: "destructive" });
     }
  }

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("username");
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};
