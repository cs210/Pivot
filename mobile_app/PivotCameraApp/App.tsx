import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
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
import AuthScreen from "./screens/AuthScreen"; // Import the AuthScreen

// Import GalleryScreen with a require statement to avoid module resolution issues
const GalleryScreen = require("./screens/GalleryScreen").default;

// Create a stack navigator
const Stack = createNativeStackNavigator();

export default function App() {
  React.useEffect(() => {
    SplashScreen.preventAutoHideAsync();
  }, []);
  // Load custom fonts
  const [fontsLoaded] = useFonts({
    ChakraPetch_400Regular,
    ChakraPetch_700Bold,
  });
  React.useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);
  if (!fontsLoaded) return null;
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
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
          name="AuthScreen"
          component={AuthScreen}
          options={{ headerShown: false }} // Hide the header for AuthScreen
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
