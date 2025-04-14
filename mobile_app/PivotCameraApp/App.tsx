import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";

// Import screens
import HomeScreen from "./screens/HomeScreen";
import CameraScreen from "./screens/CameraScreen";

// Import GalleryScreen with a require statement to avoid module resolution issues
const GalleryScreen = require("./screens/GalleryScreen").default;

// Create a stack navigator
const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: "Pivot Room Scanner" }}
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
