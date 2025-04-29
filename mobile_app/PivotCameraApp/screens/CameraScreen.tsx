import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Alert,
  Animated,
  Modal,
} from "react-native";
import { CameraView } from "expo-camera";
import { Accelerometer, DeviceMotion } from "expo-sensors";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { Camera } from "expo-camera";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, GRADIENTS, STYLES } from "../theme";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

// Define regions for room scanning (horizontal angle divisions)
const HORIZONTAL_REGIONS = 8;
const VERTICAL_REGIONS = 3;

// This determines the overlap between photographs
const REGION_THRESHOLD = 15; // degrees of overlap between regions

// Region labels for more intuitive guidance
const VERTICAL_LABELS = ["Floor", "Middle", "Ceiling"];

interface CapturedImage {
  uri: string;
  region: number;
}

interface OrientationData {
  alpha: number;
  beta: number;
}

// Extend with tutorial steps shown to new users
interface TutorialStep {
  title: string;
  description: string;
  image?: any; // Optional image to show
}

const CameraScreen: React.FC = () => {
  const navigation = useNavigation();
  const cameraRef = useRef<any>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraReady, setCameraReady] = useState<boolean>(false);
  const [capturing, setCapturing] = useState<boolean>(false);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);

  // Add tutorial state
  const [showTutorial, setShowTutorial] = useState<boolean>(true);
  const [tutorialStep, setTutorialStep] = useState<number>(0);

  // Tutorial steps content
  const tutorialSteps: TutorialStep[] = [
    {
      title: "Welcome to Room Scanner",
      description:
        "This app helps you capture your entire room systematically to create a 3D model.",
    },
    {
      title: "Take Photos in a Circle",
      description:
        "Stand in the center of your room and rotate in place, taking photos as you go. The app will guide you.",
    },
    {
      title: "Cover All Angles",
      description:
        "Capture 3 levels: floor, middle, and ceiling. Green dots show completed areas.",
    },
    {
      title: "Follow the Arrows",
      description:
        "Arrows will guide you to uncaptured regions. Make sure photos overlap by about 30-40%.",
    },
  ];

  // Device orientation tracking
  const [orientation, setOrientation] = useState<OrientationData>({
    alpha: 0, // horizontal angle (0-360)
    beta: 0, // vertical angle (-180 to 180)
  });

  // Track which regions of the room have been photographed
  const [capturedRegions, setCapturedRegions] = useState<boolean[]>(
    Array(HORIZONTAL_REGIONS * VERTICAL_REGIONS).fill(false)
  );

  // Current vertical level indicator
  const [currentVerticalLevel, setCurrentVerticalLevel] = useState<number>(1); // 0=floor, 1=middle, 2=ceiling

  // Animated value for guidance indicator
  const indicatorPosition = useRef(new Animated.Value(0)).current;
  const indicatorOpacity = useRef(new Animated.Value(1)).current;

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

  // Setup device motion tracking
  useEffect(() => {
    DeviceMotion.setUpdateInterval(100); // Update every 100ms

    const subscription = DeviceMotion.addListener((data) => {
      // Convert device orientation to angle values
      const { alpha, beta, gamma } = data.rotation;

      // Alpha: horizontal rotation (compass direction)
      // Beta: vertical tilt (up/down)
      setOrientation({
        alpha: ((alpha * 180) / Math.PI + 360) % 360,
        beta: (beta * 180) / Math.PI,
      });

      // Update current vertical level based on beta angle
      if ((beta * 180) / Math.PI < -30) {
        setCurrentVerticalLevel(0); // Floor
      } else if ((beta * 180) / Math.PI > 30) {
        setCurrentVerticalLevel(2); // Ceiling
      } else {
        setCurrentVerticalLevel(1); // Middle
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Determine the current region based on device orientation
  const getCurrentRegion = (): number => {
    const horizontalRegion = Math.floor(
      (orientation.alpha / 360) * HORIZONTAL_REGIONS
    );

    // Vertical region (3 regions: floor, middle, ceiling)
    // Beta ranges from -90 (pointing down) to +90 (pointing up)
    let verticalRegion = 1; // Default to middle
    if (orientation.beta < -30) {
      verticalRegion = 0; // Floor
    } else if (orientation.beta > 30) {
      verticalRegion = 2; // Ceiling
    }

    return horizontalRegion + verticalRegion * HORIZONTAL_REGIONS;
  };

  // Check if the current region needs to be photographed
  const needsPhotograph = (): boolean => {
    const currentRegion = getCurrentRegion();
    return !capturedRegions[currentRegion];
  };

  // Animation for guidance indicator
  useEffect(() => {
    if (!needsPhotograph()) {
      // This region is already captured, pulse the indicator
      Animated.loop(
        Animated.sequence([
          Animated.timing(indicatorOpacity, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(indicatorOpacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      // Reset animation when moving to a new region
      indicatorOpacity.setValue(1);
    }
  }, [orientation, capturedRegions]);

  // Calculate the position for the directional guide
  const calculateGuidePosition = () => {
    const currentRegion = getCurrentRegion();
    const targetRegion = capturedRegions.findIndex((region) => !region);

    if (targetRegion === -1) return null; // All regions captured

    const currentHorizontal = currentRegion % HORIZONTAL_REGIONS;
    const targetHorizontal = targetRegion % HORIZONTAL_REGIONS;

    const currentVertical = Math.floor(currentRegion / HORIZONTAL_REGIONS);
    const targetVertical = Math.floor(targetRegion / HORIZONTAL_REGIONS);

    // Determine arrow direction
    let direction = "";
    let horizontalOffset = 0;
    let verticalOffset = 0;

    // Horizontal direction
    if (currentHorizontal !== targetHorizontal) {
      // Need to calculate the shortest path (can go left or right in a circle)
      const clockwiseDist =
        (targetHorizontal - currentHorizontal + HORIZONTAL_REGIONS) %
        HORIZONTAL_REGIONS;
      const counterClockwiseDist =
        (currentHorizontal - targetHorizontal + HORIZONTAL_REGIONS) %
        HORIZONTAL_REGIONS;

      if (clockwiseDist < counterClockwiseDist) {
        direction += "right";
        horizontalOffset = 50; // Push to right side
      } else {
        direction += "left";
        horizontalOffset = -50; // Push to left side
      }
    }

    // Vertical direction
    if (currentVertical !== targetVertical) {
      if (currentVertical < targetVertical) {
        direction += direction ? "-up" : "up";
        verticalOffset = -50; // Push to top
      } else {
        direction += direction ? "-down" : "down";
        verticalOffset = 50; // Push to bottom
      }
    }

    return {
      direction,
      position: {
        top: SCREEN_HEIGHT / 2 + verticalOffset,
        left: SCREEN_WIDTH / 2 + horizontalOffset,
      },
    };
  };

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

      // Update captured regions
      const currentRegion = getCurrentRegion();
      const updatedRegions = [...capturedRegions];
      updatedRegions[currentRegion] = true;

      setCapturedRegions(updatedRegions);
      setCapturedImages([
        ...capturedImages,
        {
          uri: filename,
          region: currentRegion,
        },
      ]);

      // Check if all regions are captured
      const remaining = updatedRegions.filter((r) => !r).length;
      if (remaining === 0) {
        Alert.alert(
          "Room Scan Complete",
          "You have captured all regions of the room!",
          [
            {
              text: "View Gallery",
              onPress: () => navigation.navigate("Gallery" as never),
            },
          ]
        );
      }
    } catch (error) {
      console.error("Error taking picture:", error);
      Alert.alert("Error", "Failed to capture image. Please try again.");
    } finally {
      setCapturing(false);
    }
  };

  // Calculate completion percentage
  const completionPercentage = Math.round(
    (capturedRegions.filter(Boolean).length / capturedRegions.length) * 100
  );

  // Generate guide arrow based on direction needed
  const renderGuideArrow = () => {
    const guide = calculateGuidePosition();

    if (!guide) return null; // All regions captured

    let iconName: any = "arrow-forward";
    let directionText = "right";

    if (guide.direction === "left") {
      iconName = "arrow-back";
      directionText = "left";
    } else if (guide.direction === "right") {
      iconName = "arrow-forward";
      directionText = "right";
    } else if (guide.direction === "up") {
      iconName = "arrow-up";
      directionText = "up";
    } else if (guide.direction === "down") {
      iconName = "arrow-down";
      directionText = "down";
    } else if (guide.direction === "left-up") {
      iconName = "arrow-back-outline";
      directionText = "up-left";
    } else if (guide.direction === "right-up") {
      iconName = "arrow-forward-outline";
      directionText = "up-right";
    } else if (guide.direction === "left-down") {
      iconName = "arrow-back-outline";
      directionText = "down-left";
    } else if (guide.direction === "right-down") {
      iconName = "arrow-forward-outline";
      directionText = "down-right";
    }

    return (
      <Animated.View
        style={[
          styles.guideArrow,
          {
            top: guide.position.top,
            left: guide.position.left,
            opacity: indicatorOpacity,
          },
        ]}
      >
        <View style={styles.guideArrowCircle}>
          <Ionicons name={iconName} size={32} color="white" />
        </View>
        <Text style={styles.guideArrowText}>Move {directionText}</Text>
      </Animated.View>
    );
  };

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
          {/* Status bar */}
          <View style={styles.statusBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={28} color="white" />
            </TouchableOpacity>
            <View style={styles.progressContainer}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${completionPercentage}%` },
                ]}
              />
              <Text style={styles.progressText}>
                {completionPercentage}% Complete
              </Text>
            </View>
          </View>

          {/* Current Level Indicator */}
          <View style={styles.levelIndicator}>
            <Text style={styles.levelIndicatorText}>
              {VERTICAL_LABELS[currentVerticalLevel]}
            </Text>
          </View>

          {/* Direction guide */}
          {renderGuideArrow()}

          {/* Region indicators */}
          <View style={styles.regionsOverlay}>
            {capturedRegions.map((captured, index) => {
              const horizontalRegion = index % HORIZONTAL_REGIONS;
              const verticalRegion = Math.floor(index / HORIZONTAL_REGIONS);

              // Only show indicators for horizontal regions in the current vertical level
              const currentVertical = Math.floor(
                getCurrentRegion() / HORIZONTAL_REGIONS
              );
              if (verticalRegion !== currentVertical) return null;

              // Calculate position based on index
              const angle =
                (horizontalRegion / HORIZONTAL_REGIONS) * 2 * Math.PI;
              const radius = 120; // Distance from center
              const left = SCREEN_WIDTH / 2 + radius * Math.sin(angle);
              const top = SCREEN_HEIGHT / 2 - radius * Math.cos(angle);

              return (
                <View
                  key={`region-${index}`}
                  style={[
                    styles.regionIndicator,
                    {
                      left: left - 8,
                      top: top - 8,
                      backgroundColor: captured ? "#4CAF50" : "#ccc",
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* 3D Progress Sphere - Small visual in corner showing overall progress */}
          <View style={styles.miniMap}>
            {Array.from({ length: VERTICAL_REGIONS }).map((_, vIndex) => (
              <View key={`v-${vIndex}`} style={styles.miniMapRow}>
                {Array.from({ length: HORIZONTAL_REGIONS }).map((_, hIndex) => {
                  const index = hIndex + vIndex * HORIZONTAL_REGIONS;
                  return (
                    <View
                      key={`mm-${index}`}
                      style={[
                        styles.miniMapDot,
                        {
                          backgroundColor: capturedRegions[index]
                            ? "#4CAF50"
                            : "#ccc",
                          opacity: vIndex === currentVerticalLevel ? 1 : 0.5,
                        },
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>

          {/* Capture button and instructions */}
          <View style={styles.controlsContainer}>
            <View style={[styles.instructionCard, STYLES.card]}>
              <Text
                style={[styles.instructionText, { color: COLORS.foreground }]}
              >
                {needsPhotograph()
                  ? "Capture this angle of the room"
                  : "Move your camera to an uncaptured area"}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.captureButton,
                {
                  borderColor: COLORS.primary,
                  backgroundColor: COLORS.primaryForeground,
                },
                !needsPhotograph() && { opacity: 0.5 },
              ]}
              onPress={takePicture}
              disabled={!needsPhotograph() || capturing}
            >
              {capturing ? (
                <View style={styles.capturingIndicator} />
              ) : (
                <View
                  style={[
                    styles.captureButtonInner,
                    { backgroundColor: COLORS.primary },
                  ]}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.galleryButton}
              onPress={() => navigation.navigate("Gallery" as never)}
            >
              <Text style={styles.galleryButtonText}>
                {capturedImages.length} Images
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>

      {/* Tutorial Modal */}
      <Modal visible={showTutorial} animationType="slide" transparent={true}>
        <View style={styles.tutorialOverlay}>
          <View style={styles.tutorialCard}>
            <Text style={styles.tutorialTitle}>
              {tutorialSteps[tutorialStep].title}
            </Text>
            <Text style={styles.tutorialDescription}>
              {tutorialSteps[tutorialStep].description}
            </Text>

            {/* Tutorial Navigation */}
            <View style={styles.tutorialNav}>
              <View style={styles.tutorialDots}>
                {tutorialSteps.map((_, index) => (
                  <View
                    key={`dot-${index}`}
                    style={[
                      styles.tutorialDot,
                      tutorialStep === index && styles.tutorialDotActive,
                    ]}
                  />
                ))}
              </View>

              {tutorialStep < tutorialSteps.length - 1 ? (
                <TouchableOpacity
                  style={styles.tutorialButton}
                  onPress={() => setTutorialStep(tutorialStep + 1)}
                >
                  <Text style={styles.tutorialButtonText}>Next</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.tutorialButton}
                  onPress={() => setShowTutorial(false)}
                >
                  <Text style={styles.tutorialButtonText}>Get Started</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  backButton: {
    padding: 8,
  },
  progressContainer: {
    flex: 1,
    height: 24,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 12,
    marginLeft: 15,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#4a90e2",
  },
  progressText: {
    position: "absolute",
    width: "100%",
    textAlign: "center",
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
    lineHeight: 24,
  },
  regionsOverlay: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  regionIndicator: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "white",
  },
  guideArrow: {
    position: "absolute",
    width: 100,
    height: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  guideArrowCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(74, 144, 226, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  guideArrowText: {
    color: "white",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginTop: 6,
    fontSize: 14,
    fontWeight: "bold",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  controlsContainer: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  instructionCard: {
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginBottom: 20,
  },
  instructionText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
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
  captureButtonDisabled: {
    backgroundColor: "rgba(150,150,150,0.3)",
  },
  captureButtonInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "white",
  },
  capturingIndicator: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#ff3b30",
  },
  galleryButton: {
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  galleryButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  tutorialOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  tutorialCard: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: "80%",
    alignItems: "center",
  },
  tutorialTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  tutorialDescription: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  tutorialNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  tutorialDots: {
    flexDirection: "row",
  },
  tutorialDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ccc",
    marginHorizontal: 4,
  },
  tutorialDotActive: {
    backgroundColor: "#4a90e2",
  },
  tutorialButton: {
    backgroundColor: "#4a90e2",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  tutorialButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  levelIndicator: {
    position: "absolute",
    top: 100,
    left: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  levelIndicatorText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  miniMap: {
    position: "absolute",
    top: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 10,
    borderRadius: 10,
  },
  miniMapRow: {
    flexDirection: "row",
  },
  miniMapDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    margin: 2,
  },
});

export default CameraScreen;
