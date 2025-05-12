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
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
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
  const [permission, requestPermission] = useCameraPermissions();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraReady, setCameraReady] = useState<boolean>(false);
  const [capturing, setCapturing] = useState<boolean>(false);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);

  // Ask for camera permissions
  useEffect(() => {
    (async () => {
      try {
        console.log("Requesting camera permissions...");
        const cameraStatus = await requestPermission();
        console.log("Camera permission status:", cameraStatus.status);

        const { status: mediaStatus } =
          await MediaLibrary.requestPermissionsAsync();
        console.log("Media library permission status:", mediaStatus);

        const hasBothPermissions =
          cameraStatus.status === "granted" && mediaStatus === "granted";
        console.log("Has both permissions:", hasBothPermissions);

        setHasPermission(hasBothPermissions);

        if (!hasBothPermissions) {
          Alert.alert(
            "Permission Required",
            "Camera and media library permissions are required to use this app.",
            [{ text: "OK", onPress: () => navigation.goBack() }]
          );
        }
      } catch (error) {
        console.error("Error requesting permissions:", error);
        Alert.alert("Error", "Failed to request camera permissions.");
      }
    })();
  }, []);

  // Take a picture
  const takePicture = async () => {
    if (!cameraRef.current || !cameraReady || capturing) {
      console.log("Cannot take picture:", {
        hasCameraRef: !!cameraRef.current,
        cameraReady,
        isCapturing: capturing,
      });
      return;
    }

    setCapturing(true);
    console.log("Attempting to take picture...");

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        exif: true,
        skipProcessing: true,
      });
      console.log("Picture taken successfully:", photo.uri);

      // Create directory if it doesn't exist
      const dirPath = `${FileSystem.documentDirectory}room_scanner/`;
      const dirInfo = await FileSystem.getInfoAsync(dirPath);

      if (!dirInfo.exists) {
        console.log("Creating directory:", dirPath);
        await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
      }

      // Save image
      const timestamp = new Date().getTime();
      const filename = `${dirPath}room_${timestamp}.jpg`;
      console.log("Saving image to:", filename);

      await FileSystem.moveAsync({
        from: photo.uri,
        to: filename,
      });

      // Save to media library
      console.log("Saving to media library...");
      await MediaLibrary.saveToLibraryAsync(filename);
      console.log("Image saved successfully");

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
    console.log("Permission status is null - requesting permissions");
    return (
      <View style={styles.container}>
        <Text>Requesting permissions...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    console.log("Permission denied");
    return (
      <View style={styles.container}>
        <Text>No access to camera</Text>
      </View>
    );
  }

  console.log("Rendering camera view, cameraReady:", cameraReady);

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        onCameraReady={() => {
          console.log("Camera is ready");
          setCameraReady(true);
        }}
      />

      <View style={styles.overlay}>
        <SafeAreaView style={styles.statusBar}>
          <Text style={styles.progressText}>{capturedCount} Images</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={28} color="white" />
          </TouchableOpacity>
        </SafeAreaView>

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
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
