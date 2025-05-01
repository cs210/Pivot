import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { COLORS, GRADIENTS, FONT, STYLES } from "../theme";
import { useNavigation, NavigationProp } from "@react-navigation/native"; // Import NavigationProp
import { supabase } from "../utils/supabase"; // Import the configured Supabase client
import { RootStackParamList } from "../types"; // Assuming you have a types file defining your navigation params

const AuthScreen = () => {
  // Define the navigation prop type more specifically
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const { data: loginData, error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError) {
      Alert.alert("Login Error", loginError.message);
      setLoading(false);
      return; // Stop execution if login failed
    }

    // Login successful, now fetch projects
    if (loginData?.user) {
      const userId = loginData.user.id;
      console.log("Logged in user ID:", userId); // Log user ID for debugging

      // Fetch project IDs associated with the user
      // Replace 'user_projects' with your actual table name
      // Replace 'user_id' and 'project_id' with your actual column names if different
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects") // <<< Your table name here
        .select("id") // <<< Your project ID column name here
        .eq("user_id", userId); // <<< Your user ID column name here

      if (projectsError) {
        console.error("Error fetching projects:", projectsError);
        Alert.alert("Error", "Could not fetch user projects.");
        // Decide if you still want to navigate or show a more specific error
        // Maybe navigate back without project IDs?
        // navigation.goBack(); // Or navigate to Home with empty array
        navigation.navigate("Home", { projectIds: [] });
      } else {
        const fetchedProjectIds = projectsData.map((p) => p.id);
        console.log("User Project IDs:", fetchedProjectIds);

        // Navigate to Home screen and pass projectIds as params
        // Ensure 'Home' is the correct route name in your navigator
        navigation.navigate("Home", { projectIds: fetchedProjectIds });
      }
    } else {
      // Handle case where user data is unexpectedly null after successful login
      Alert.alert(
        "Login Error",
        "Could not retrieve user information after login."
      );
    }

    setLoading(false); // Ensure loading is set to false in all paths
  };

  const handleSignUp = async () => {
    setLoading(true);
    // TODO: Implement Supabase sign up
    Alert.alert("Sign Up Attempt", `Email: ${email}, Password: ${password}`);
    // Example:
    // const { error } = await supabase.auth.signUp({ email, password });
    // if (error) Alert.alert('Sign Up Error', error.message);
    // else Alert.alert('Success', 'Check your email for verification!');
    setLoading(false);
  };

  return (
    <LinearGradient colors={GRADIENTS.cyber} style={styles.container}>
      {/* Back button top-left */}
      <TouchableOpacity
        style={styles.topLeftBackButton}
        onPress={() => navigation.goBack()} // Use goBack for standard pop animation
      >
        <Ionicons name="arrow-back" size={30} color={COLORS.primary} />
      </TouchableOpacity>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Large Logo */}
          <View style={styles.logoContainer}>
            <Ionicons name="compass-outline" size={80} color={COLORS.primary} />
            <Text style={styles.logoText}>Pivot</Text>
          </View>

          {/* Input Fields */}
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, { borderColor: COLORS.border }]}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              placeholderTextColor={COLORS.secondary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, { borderColor: COLORS.border }]}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              placeholderTextColor={COLORS.secondary}
              secureTextEntry
            />
          </View>

          {/* Buttons */}
          {loading ? (
            <ActivityIndicator
              size="large"
              color={COLORS.primary}
              style={styles.buttonSpacing}
            />
          ) : (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: COLORS.primary }]}
                onPress={handleLogin}
              >
                <Text
                  style={[
                    styles.buttonText,
                    { color: COLORS.primaryForeground },
                  ]}
                >
                  Login
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.secondaryButton,
                  { borderColor: COLORS.primary },
                ]}
                onPress={handleSignUp}
              >
                <Text style={[styles.buttonText, { color: COLORS.primary }]}>
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topLeftBackButton: {
    position: "absolute",
    top: 60, // Adjust as needed for status bar height
    left: 20,
    zIndex: 1,
    padding: 10, // Increase touch target
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 50,
  },
  logoText: {
    fontSize: 48,
    fontFamily: FONT.bold,
    color: COLORS.primary,
    marginTop: 10,
  },
  inputContainer: {
    width: "100%",
    marginBottom: 20,
  },
  input: {
    width: "100%",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 15,
    fontFamily: FONT.regular,
    fontSize: 16,
    color: COLORS.foreground,
    backgroundColor: COLORS.card, // Match card background
  },
  buttonContainer: {
    width: "100%",
    alignItems: "center",
  },
  button: {
    width: "100%",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
    // ...STYLES.shadow, // Apply consistent shadow - Removed as 'shadow' is not defined in STYLES
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  buttonText: {
    fontFamily: FONT.bold,
    fontSize: 18,
  },
  buttonSpacing: {
    marginVertical: 15, // Add space when loading indicator shows
  },
});

export default AuthScreen;
