import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, GRADIENTS, STYLES, FONT } from "../theme";
import { GroupStorage } from "../utils/groupStorage";

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
  const [publishModalVisible, setPublishModalVisible] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [publishing, setPublishing] = useState(false);

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

  const handlePublish = async () => {
    if (capturedImages.length === 0) {
      Alert.alert("Error", "No images to publish");
      return;
    }

    setPublishing(true);
    try {
      const imageUris = capturedImages.map((img) => img.uri);
      const group = await GroupStorage.createGroup(
        groupName || `Session ${new Date().toLocaleString()}`,
        groupDescription,
        imageUris
      );

      Alert.alert("Success", "Images published to group successfully", [
        {
          text: "OK",
          onPress: () => {
            setPublishModalVisible(false);
            setGroupName("");
            setGroupDescription("");
            setCapturedImages([]);
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      console.error("Error publishing images:", error);
      Alert.alert("Error", "Failed to publish images");
    } finally {
      setPublishing(false);
    }
  };

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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={28} color="white" />
          </TouchableOpacity>
          <Text style={styles.progressText}>{capturedCount} Images</Text>
          {capturedCount > 0 && (
            <TouchableOpacity
              style={styles.publishButton}
              onPress={() => setPublishModalVisible(true)}
            >
              <Text style={styles.publishButtonText}>Publish</Text>
            </TouchableOpacity>
          )}
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

      {/* Publish Modal */}
      <Modal
        visible={publishModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPublishModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Publish Images</Text>
            <TextInput
              style={styles.input}
              placeholder="Group Name (optional)"
              value={groupName}
              onChangeText={setGroupName}
              placeholderTextColor={COLORS.secondary}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description (optional)"
              value={groupDescription}
              onChangeText={setGroupDescription}
              placeholderTextColor={COLORS.secondary}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setPublishModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.publishButton]}
                onPress={handlePublish}
                disabled={publishing}
              >
                {publishing ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.modalButtonText}>Publish</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "transparent",
    zIndex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  backButton: {
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
  publishButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  publishButtonText: {
    color: COLORS.primaryForeground,
    fontFamily: FONT.bold,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 15,
    padding: 20,
    width: "80%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: FONT.bold,
    color: COLORS.foreground,
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    color: COLORS.foreground,
    fontFamily: FONT.regular,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: COLORS.secondary,
  },
  modalButtonText: {
    color: COLORS.primaryForeground,
    fontFamily: FONT.bold,
    fontSize: 16,
  },
});

export default CameraScreen;
