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
import { COLORS, GRADIENTS, FONT } from "../theme";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { supabase } from "../utils/supabase";
import { RootStackParamList } from "../types";

const SignUpScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        Alert.alert("Sign Up Error", error.message);
        return;
      }

      if (data?.user) {
        Alert.alert(
          "Success",
          "Please check your email to confirm your account.",
          [
            {
              text: "OK",
              onPress: () => {
                navigation.navigate("Auth");
              },
            },
          ]
        );
      }
    } catch (err) {
      console.error("Sign up error:", err);
      Alert.alert("Error", "An unexpected error occurred during sign up.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={GRADIENTS.cyber} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.headerContainer}>
            <Text style={styles.headerText}>Create Account</Text>
            <Text style={styles.subHeaderText}>
              Join Pivot to start capturing and managing your projects
            </Text>
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
            <TextInput
              style={[styles.input, { borderColor: COLORS.border }]}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholderTextColor={COLORS.secondary}
              secureTextEntry
            />
          </View>

          {/* Sign Up Button */}
          {loading ? (
            <ActivityIndicator
              size="large"
              color={COLORS.primary}
              style={styles.buttonSpacing}
            />
          ) : (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: COLORS.primary }]}
              onPress={handleSignUp}
            >
              <Text
                style={[styles.buttonText, { color: COLORS.primaryForeground }]}
              >
                Create Account
              </Text>
            </TouchableOpacity>
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
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 30,
  },
  backButton: {
    marginTop: 20,
    marginBottom: 20,
  },
  headerContainer: {
    marginBottom: 40,
  },
  headerText: {
    fontSize: 32,
    fontFamily: FONT.bold,
    color: COLORS.primary,
    marginBottom: 10,
  },
  subHeaderText: {
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.secondary,
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
    backgroundColor: COLORS.card,
  },
  button: {
    width: "100%",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  buttonText: {
    fontFamily: FONT.bold,
    fontSize: 18,
  },
  buttonSpacing: {
    marginVertical: 15,
  },
});

export default SignUpScreen;
