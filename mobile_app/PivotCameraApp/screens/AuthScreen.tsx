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
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../utils/supabase"; // Import the configured Supabase client

const AuthScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    // TODO: Implement Supabase login
    Alert.alert("Login Attempt", `Email: ${email}, Password: ${password}`);
    // Example:
    // const { error } = await supabase.auth.signInWithPassword({ email, password });
    // if (error) Alert.alert('Login Error', error.message);
    // else { /* Navigate to HomeScreen or main app */ }
    setLoading(false);
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
