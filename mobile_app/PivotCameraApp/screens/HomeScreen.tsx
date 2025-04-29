import React from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, GRADIENTS, STYLES, FONT } from "../theme";
import Ionicons from "@expo/vector-icons/Ionicons";

const HomeScreen = () => {
  const navigation = useNavigation();

  return (
    <LinearGradient colors={GRADIENTS.cyber} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.content}>
          {/* Logo and app name */}
          <View style={styles.logoContainer}>
            <Ionicons name="compass-outline" size={32} color={COLORS.primary} />
            <Text style={styles.logoText}>Pivot</Text>
          </View>

          <View style={[styles.infoCard, STYLES.card]}>
            <Text style={styles.infoTitle}>How it works</Text>
            <Text style={styles.infoText}>
              Take a series of overlapping photos of your room to create a
              complete 3D reconstruction.
            </Text>

            <View style={styles.stepContainer}>
              <View style={styles.step}>
                <Text
                  style={[
                    styles.stepNumber,
                    {
                      backgroundColor: COLORS.primary,
                      color: COLORS.primaryForeground,
                    },
                  ]}
                >
                  1
                </Text>
                <Text style={styles.stepText}>
                  Stand in the center of your room
                </Text>
              </View>

              <View style={styles.step}>
                <Text
                  style={[
                    styles.stepNumber,
                    {
                      backgroundColor: COLORS.primary,
                      color: COLORS.primaryForeground,
                    },
                  ]}
                >
                  2
                </Text>
                <Text style={styles.stepText}>
                  Follow the on-screen guidance to move your camera
                </Text>
              </View>

              <View style={styles.step}>
                <Text
                  style={[
                    styles.stepNumber,
                    {
                      backgroundColor: COLORS.primary,
                      color: COLORS.primaryForeground,
                    },
                  ]}
                >
                  3
                </Text>
                <Text style={styles.stepText}>
                  Capture images until you've covered the entire room
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.startButton, { backgroundColor: COLORS.primary }]}
              onPress={() => navigation.navigate("Camera" as never)}
            >
              <Text
                style={[
                  styles.startButtonText,
                  { color: COLORS.primaryForeground },
                ]}
              >
                Start Scanning
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.galleryButton,
                { backgroundColor: COLORS.card, borderColor: COLORS.primary },
              ]}
              onPress={() => navigation.navigate("Gallery" as never)}
            >
              <Text
                style={[styles.galleryButtonText, { color: COLORS.primary }]}
              >
                View Gallery
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    padding: 20,
    paddingTop: 40,
    alignItems: "center",
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30,
  },
  logoText: {
    fontSize: 28,
    fontFamily: FONT.bold,
    marginLeft: 10,
    color: COLORS.primary,
  },
  title: {
    fontSize: 28,
    fontFamily: FONT.bold,
    marginBottom: 30,
    color: "#333",
  },
  infoCard: {
    backgroundColor: "white",
    borderRadius: 15,
    padding: 20,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 30,
  },
  infoTitle: {
    fontSize: 20,
    fontFamily: FONT.bold,
    marginBottom: 15,
    color: "#333",
  },
  infoText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#555",
    marginBottom: 20,
    fontFamily: FONT.regular,
  },
  stepContainer: {
    marginTop: 10,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  stepNumber: {
    backgroundColor: "#4a90e2",
    color: "white",
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: "center",
    lineHeight: 28,
    fontSize: 16,
    fontFamily: FONT.bold,
    marginRight: 15,
  },
  stepText: {
    fontSize: 16,
    color: "#444",
    flex: 1,
    fontFamily: FONT.regular,
  },
  buttonContainer: {
    width: "100%",
  },
  startButton: {
    backgroundColor: "#4a90e2",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 15,
  },
  startButtonText: {
    color: "white",
    fontSize: 18,
    fontFamily: FONT.bold,
  },
  galleryButton: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4a90e2",
  },
  galleryButtonText: {
    color: "#4a90e2",
    fontSize: 18,
    fontFamily: FONT.bold,
  },
});

export default HomeScreen;
