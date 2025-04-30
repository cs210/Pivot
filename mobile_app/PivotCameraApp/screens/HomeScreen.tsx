import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, GRADIENTS, STYLES, FONT } from "../theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as FileSystem from "expo-file-system";

const HomeScreen = () => {
  const navigation = useNavigation();
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const IMAGE_SIZE = (Dimensions.get("window").width - 40) / 3;

  useEffect(() => {
    (async () => {
      const dir = `${FileSystem.documentDirectory}room_scanner/`;
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) {
        setImages([]);
        setLoading(false);
        return;
      }
      const files = await FileSystem.readDirectoryAsync(dir);
      const jpgs = files.filter((f) => f.match(/\.(jpe?g|png)$/));
      setImages(jpgs.map((f) => dir + f));
      setLoading(false);
    })();
  }, []);

  return (
    <LinearGradient colors={GRADIENTS.cyber} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: 60 }]} // Move paddingTop to inline style
        showsVerticalScrollIndicator={false}
      >
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

        {/* Inline gallery */}
        <View style={styles.galleryContainer}>
          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} />
          ) : (
            <FlatList
              data={images}
              keyExtractor={(uri) => uri}
              numColumns={3}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item }}
                  style={{
                    width: IMAGE_SIZE,
                    height: IMAGE_SIZE,
                    margin: 2,
                    borderRadius: 6,
                  }}
                />
              )}
            />
          )}
        </View>
      </ScrollView>

      {/* Fixed camera button */}
      <View style={styles.cameraButtonContainer}>
        <TouchableOpacity
          style={styles.cameraButton}
          onPress={() => navigation.navigate("Camera" as never)}
        >
          <Ionicons name="camera" size={36} color="white" />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    padding: 20,
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
  galleryContainer: {
    width: "100%",
    marginBottom: 90, // Increased bottom margin to make room for the camera button
  },
  cameraButtonContainer: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 50,
    width: 70,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
    // Add shadow for better visibility
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
});

export default HomeScreen;
