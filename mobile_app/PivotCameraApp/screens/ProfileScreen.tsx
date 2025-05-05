import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { supabase } from "../utils/supabase";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { RootStackParamList } from "../types";
import { GRADIENTS, COLORS, FONT } from "../theme";

const ProfileScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) Alert.alert("Error", error.message);
      else setUser(data.user);
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert("Error", error.message);
    else navigation.reset({ index: 0, routes: [{ name: "Auth" }] });
  };

  return (
    <LinearGradient colors={GRADIENTS.cyber} style={styles.gradientBackground}>
      {/* Back Button */}
      <TouchableOpacity
        style={styles.topLeftBackButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={28} color={COLORS.primary} />
      </TouchableOpacity>
      {/* Main Content */}
      <View style={styles.contentContainer}>
        <Ionicons
          name="person-circle"
          size={160}
          color={COLORS.primaryForeground}
          style={styles.icon}
        />
        <Text style={styles.header}>Profile</Text>
        {user ? (
          <>
            <Text style={styles.info}>Email: {user.email}</Text>
            <TouchableOpacity
              style={[styles.button, styles.logoutButton]}
              onPress={handleLogout}
            >
              <Text style={styles.buttonText}>Logout</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.loading}>Loading...</Text>
        )}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientBackground: { flex: 1 },
  contentContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  icon: { marginBottom: 20 },
  header: {
    fontSize: 32,
    fontFamily: FONT.bold,
    marginBottom: 20,
    color: COLORS.primary,
  },
  info: {
    fontSize: 18,
    fontFamily: FONT.regular,
    marginBottom: 30,
    color: COLORS.foreground,
  },
  loading: {
    fontSize: 18,
    fontFamily: FONT.regular,
    color: COLORS.primaryForeground,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  logoutButton: {
    position: "absolute",
    bottom: 40,
  },
  buttonText: {
    color: COLORS.primaryForeground,
    fontSize: 16,
    fontFamily: FONT.bold,
  },
  // Style for the back button
  topLeftBackButton: {
    position: "absolute",
    top: 60, // Adjust as needed for status bar height
    left: 20,
    zIndex: 1,
    padding: 10, // Increase touch target
  },
});

export default ProfileScreen;
