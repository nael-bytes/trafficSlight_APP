// import 'react-native-gesture-handler';
// import React, { useContext } from "react";
// import { View, ActivityIndicator } from "react-native"; // ✅ Import these

// import * as Linking from 'expo-linking';
// import { NavigationContainer } from "@react-navigation/native";
// import { SafeAreaProvider } from 'react-native-safe-area-context';
// import { Provider as PaperProvider } from "react-native-paper";

// import { AuthContext, AuthProvider } from "./AuthContext/AuthContext";
// import { UserContext, UserProvider } from "./AuthContext/UserContext";
// import SignedOutStack from "./Navigation/SignedOutStack";
// import SignedInStack from "./Navigation/SignedInStack";

// function MainApp() {
//   // ✅ Access both contexts
//   const { userToken, authLoading } = useContext(AuthContext);
//   const { loading: userLoading } = useContext(UserContext);

//   const linking = {
//     prefixes: ['trafficslight://'],
//     config: {
//       screens: {
//         VerifyScreen: 'verify/:token',
//         Login: 'login',
//         RegisterScreen: 'register',
//       },
//     },
//   };

//   // ✅ Show loader while either context is initializing
//   if (authLoading || userLoading) {
//     return (
//       <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
//         <ActivityIndicator size="large" color="#007AFF" />
//       </View>
//     );
//   }

//   return (
//     <SafeAreaProvider>
//       <PaperProvider>
//         <NavigationContainer linking={linking}>
//           {userToken ? <SignedInStack /> : <SignedOutStack />}
//         </NavigationContainer>
//       </PaperProvider>
//     </SafeAreaProvider>
//   );
// }

// export default function App() {
//   return (
//     <AuthProvider>
//       <UserProvider>
//         <MainApp />
//       </UserProvider>
//     </AuthProvider>
//   );
// }



import 'react-native-gesture-handler';
import React, { useContext } from "react";

import * as Linking from 'expo-linking';
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from 'react-native-safe-area-context'; // ✅ Add this
import { Provider as PaperProvider } from "react-native-paper";
import { AuthContext, AuthProvider } from "./AuthContext/AuthContext";
import { UserContext, UserProvider } from "./AuthContext/UserContext";
import SignedOutStack from "./Navigation/SignedOutStack";
import SignedInStack from "./Navigation/SignedInStack";

function MainApp() {
  const { userToken } = useContext(AuthContext);

  const linking = {
    prefixes: ['trafficslight://'],
    config: {
      screens: {
        VerifyScreen: 'verify/:token',
        Login: 'login',
        RegisterScreen: 'register',
        // Add more screens as needed
      },
    },
  };

    // // ✅ Show loader while either context is still initializing
    // if (authLoading || userLoading) {
    //   return (
    //     <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
    //       <ActivityIndicator size="large" color="#007AFF" />
    //     </View>
    //   );
    // }

  return (
    <SafeAreaProvider>
      <PaperProvider>
        <NavigationContainer linking={linking}>
          {userToken ? <SignedInStack /> : <SignedOutStack />}
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <UserProvider>
        <MainApp />
      </UserProvider>
    </AuthProvider>
  );
}
