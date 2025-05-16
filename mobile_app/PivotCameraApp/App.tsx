import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { supabase } from "./utils/supabase";
import type { User } from "@supabase/supabase-js";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  ChakraPetch_400Regular,
  ChakraPetch_700Bold,
} from "@expo-google-fonts/chakra-petch";
import { Text } from "react-native";
import { FONT } from "./theme";

// Import screens
import HomeScreen from "./screens/HomeScreen";
import CameraScreen from "./screens/CameraScreen";
import GroupDetailScreen from "./screens/GroupDetailScreen";
import AuthScreen from "./screens/AuthScreen";
import ProfileScreen from "./screens/ProfileScreen"; // Import the new Profile screen
import SignUpScreen from "./screens/SignUpScreen"; // Import the new SignUp screen

// Import GalleryScreen with a require statement to avoid module resolution issues
const GalleryScreen = require("./screens/GalleryScreen").default;

// Create a stack navigator
const Stack = createNativeStackNavigator();

export default function App() {
  // Hold splash open until fonts and auth are ready
  React.useEffect(() => {
    SplashScreen.preventAutoHideAsync();
  }, []);
  // Load custom fonts
  const [fontsLoaded] = useFonts({
    ChakraPetch_400Regular,
    ChakraPetch_700Bold,
  });
  // Track authentication state
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);
  React.useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);
  // Don't render until fonts and auth state are ready
  if (!fontsLoaded) return null;
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      {/* If not logged in, show only Auth stack */}
      {!user ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Auth" component={AuthScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Camera"
            component={CameraScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Gallery"
            component={GalleryScreen}
            options={{ title: "Captured Images" }}
          />
          <Stack.Screen
            name="GroupDetail"
            component={GroupDetailScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
