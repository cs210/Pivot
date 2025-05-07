import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
} from "react-native";
import { CameraView } from "expo-camera";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { Camera } from "expo-camera";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, GRADIENTS, STYLES } from "../theme";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

interface CapturedImage {
  uri: string;
}

const CameraScreen: React.FC = () => {
  const navigation = useNavigation();
  const cameraRef = useRef<any>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraReady, setCameraReady] = useState<boolean>(false);
  const [capturing, setCapturing] = useState<boolean>(false);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);

  // Ask for camera permissions
  useEffect(() => {
    (async () => {
      const { status: cameraStatus } =
        await Camera.requestCameraPermissionsAsync();
      const { status: mediaStatus } =
        await MediaLibrary.requestPermissionsAsync();
      setHasPermission(cameraStatus === "granted" && mediaStatus === "granted");
      if (cameraStatus !== "granted" || mediaStatus !== "granted") {
        Alert.alert(
          "Permission Required",
          "Camera and media library permissions are required to use this app.",
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      }
    })();
  }, []);

  // Take a picture
  const takePicture = async () => {
    if (!cameraRef.current || !cameraReady || capturing) return;

    setCapturing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        exif: true,
      });

      // Create directory if it doesn't exist
      const dirPath = `${FileSystem.documentDirectory}room_scanner/`;
      const dirInfo = await FileSystem.getInfoAsync(dirPath);

      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
      }

      // Save image
      const timestamp = new Date().getTime();
      const filename = `${dirPath}room_${timestamp}.jpg`;

      await FileSystem.moveAsync({
        from: photo.uri,
        to: filename,
      });

      // Save to media library
      await MediaLibrary.saveToLibraryAsync(filename);

      setCapturedImages([
        ...capturedImages,
        {
          uri: filename,
        },
      ]);
    } catch (error) {
      console.error("Error taking picture:", error);
      Alert.alert("Error", "Failed to capture image. Please try again.");
    } finally {
      setCapturing(false);
    }
  };

  // Calculate number of captured images
  const capturedCount = capturedImages.length;

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text>Requesting permissions...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text>No access to camera</Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={GRADIENTS.cyber} style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        onCameraReady={() => setCameraReady(true)}
      >
        <View style={styles.overlay}>
          {/* Header: back and count */}
          <SafeAreaView style={styles.statusBar}>
            <Text style={styles.progressText}>{capturedCount} Images</Text>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={28} color="white" />
            </TouchableOpacity>
          </SafeAreaView>

          {/* Capture button */}
          <View style={styles.controlsContainer}>
            <TouchableOpacity
              style={[styles.captureButton, capturing && { opacity: 0.7 }]}
              onPress={takePicture}
              disabled={capturing}
            >
              {capturing ? (
                <ActivityIndicator color="white" size="large" />
              ) : (
                <Ionicons name="camera" size={40} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  statusBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
    zIndex: 1,
  },
  backButton: {
    position: "absolute",
    left: 20,
    padding: 8,
  },
  progressText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  controlsContainer: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
});
export default CameraScreen;
