import React, { createContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [userToken, setUserToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const checkToken = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        setUserToken(token);
      } catch (error) {
        console.error("❌ Error checking token:", error);
      } finally {
        setAuthLoading(false);
      }
    };
    checkToken();
  }, [])

  const login = async (token) => {
    await AsyncStorage.setItem("token", token);
    setUserToken(token);
  };

  const logout = async () => {
    await AsyncStorage.removeItem("token");
    setUserToken(null);
  };

  return (
    <AuthContext.Provider value={{ userToken, login, logout, authLoading  }}>
      {children}
    </AuthContext.Provider>
  );
};
