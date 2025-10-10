import React, { createContext, useState, useEffect, useContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🔹 Load user when app starts
  useEffect(() => {
    const loadUser = async () => {
      try {
        console.log("🔄 Loading user from AsyncStorage...");
        const storedUser = await AsyncStorage.getItem("user");

        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          console.log("✅ User loaded:", parsedUser);
          setUser(parsedUser);
        } else {
          console.log("ℹ️ No user found in storage.");
        }
      } catch (error) {
        console.error("❌ Error loading user:", error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  // 🔹 Save user to storage (called after login)
  const saveUser = async (userData, onLoginSuccess) => {
    try {
      await AsyncStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);

      console.log("✅ User saved successfully:", userData);

      // 🔸 Trigger other actions after login (load motors, etc.)
      if (onLoginSuccess && typeof onLoginSuccess === "function") {
        onLoginSuccess(userData);
      }

    } catch (error) {
      console.error("❌ Failed to save user:", error);
    }
  };

  // 🔹 Clear user data (logout)
  const clearUser = async () => {
    try {
      await AsyncStorage.removeItem("user");
      setUser(null);
      console.log("🚪 User logged out and cleared.");
    } catch (error) {
      console.error("❌ Failed to clear user:", error);
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        saveUser,
        clearUser,
        loading,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

// 🔹 Custom hook
export const useUser = () => useContext(UserContext);


// import React, { createContext, useState, useEffect, useContext } from "react";
// import AsyncStorage from "@react-native-async-storage/async-storage";

// const UserContext = createContext();

// export const UserProvider = ({ children }) => {
//   const [user, setUser] = useState(null);
//   const [loading, setLoading] = useState(true); // Optional loading state

//   useEffect(() => {
//     const loadUser = async () => {
//       try {
//         console.log("Loading user from AsyncStorage...");
//         const storedUser = await AsyncStorage.getItem("user");
//         console.log("Stored user raw data:", storedUser);
//         if (storedUser) {
//           const parsedUser = JSON.parse(storedUser);
//           console.log("Parsed user data:", parsedUser);
//           setUser(parsedUser);
//         } else {
//           console.log("No user found in storage");
//         }
//       } catch (error) {
//         console.error("Error loading user:", error);
//       }
//       setLoading(false);
//     };
//     loadUser();
//   }, []);

//   const saveUser = async (userData) => {
//     try {
//       await AsyncStorage.setItem("user", JSON.stringify(userData));
//       setUser(userData);
//     } catch (error) {
//       console.error("Failed to save user:", error);
//     }
//   };

//   const clearUser = async () => {
//     try {
//       await AsyncStorage.removeItem("user");
//       setUser(null);
//     } catch (error) {
//       console.error("Failed to clear user:", error);
//     }
//   };

//   return (
//     <UserContext.Provider value={{ user, saveUser, clearUser, loading }}>
//       {children}
//     </UserContext.Provider>
//   );
// };

// // Custom hook for easy access
// export const useUser = () => useContext(UserContext);
