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
  Alert,
} from "react-native";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, GRADIENTS, STYLES, FONT } from "../theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as FileSystem from "expo-file-system";

const HomeScreen = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const IMAGE_SIZE = (Dimensions.get("window").width - 40) / 3;
  const [showHowItWorks, setShowHowItWorks] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  // Add state for active tab
  const [activeTab, setActiveTab] = useState("recents");

  useEffect(() => {
    loadImages();
  }, [isFocused]);

  const loadImages = async () => {
    try {
      setLoading(true);
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
    } catch (error) {
      console.error("Error loading images:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleImageSelection = (uri: string) => {
    if (selectedImages.includes(uri)) {
      setSelectedImages(selectedImages.filter((img) => img !== uri));
    } else {
      setSelectedImages([...selectedImages, uri]);
    }
  };

  const deleteSelectedImages = async () => {
    if (selectedImages.length === 0) return;

    Alert.alert(
      "Delete Images",
      `Are you sure you want to delete ${selectedImages.length} selected image${
        selectedImages.length > 1 ? "s" : ""
      }?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              for (const uri of selectedImages) {
                await FileSystem.deleteAsync(uri);
              }
              setSelectedImages([]);
              loadImages();
            } catch (error) {
              console.error("Error deleting images:", error);
              Alert.alert("Error", "Failed to delete selected images");
            }
          },
        },
      ]
    );
  };

  const toggleEditMode = () => {
    setEditMode(!editMode);
    if (editMode) {
      setSelectedImages([]);
    }
  };

  return (
    <LinearGradient colors={GRADIENTS.cyber} style={styles.container}>
      {/* Help button in top left */}
      <TouchableOpacity
        style={styles.helpButton}
        onPress={() => setShowHowItWorks(!showHowItWorks)}
      >
        <Ionicons name="help-circle" size={50} color={COLORS.primary} />
      </TouchableOpacity>

      <View style={styles.fixedContent}>
        {/* Logo and app name */}
        <View style={[styles.logoContainer, { alignSelf: "center" }]}>
          <Ionicons name="compass-outline" size={32} color={COLORS.primary} />
          <Text style={styles.logoText}>Pivot</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "recents" && styles.activeTab]}
            onPress={() => setActiveTab("recents")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "recents" && styles.activeTabText,
              ]}
            >
              Recents
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === "groups" && styles.activeTab]}
            onPress={() => setActiveTab("groups")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "groups" && styles.activeTabText,
              ]}
            >
              Groups
            </Text>
          </TouchableOpacity>
        </View>

        {showHowItWorks && activeTab === "recents" && (
          <View style={[styles.infoCard, STYLES.card]}>
            {/* Close button in top right */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowHowItWorks(false)}
            >
              <Ionicons name="close" size={24} color={COLORS.secondary} />
            </TouchableOpacity>

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
        )}

        {/* Gallery header with Edit button (only for Recents tab) */}
        {activeTab === "recents" && (
          <View style={styles.headerRow}>
            <Text style={styles.galleryHeader}>Recent Captures</Text>
            {images.length > 0 && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={toggleEditMode}
              >
                <Text style={styles.editButtonText}>
                  {editMode ? "Done" : "Edit"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Content based on active tab */}
      {activeTab === "recents" ? (
        <View style={styles.galleryContainer}>
          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} />
          ) : (
            <FlatList
              data={images}
              keyExtractor={(uri) => uri}
              numColumns={3}
              contentContainerStyle={styles.galleryContent}
              ListEmptyComponent={
                <View style={styles.emptyGallery}>
                  <Ionicons
                    name="images-outline"
                    size={48}
                    color={COLORS.secondary}
                  />
                  <Text style={styles.emptyText}>No images captured yet</Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={editMode ? 0.6 : 1}
                  onPress={() => editMode && toggleImageSelection(item)}
                  style={styles.imageContainer}
                >
                  <Image source={{ uri: item }} style={styles.image} />
                  {editMode && (
                    <TouchableOpacity
                      style={[
                        styles.deleteButton,
                        selectedImages.includes(item) &&
                          styles.selectedDeleteButton,
                      ]}
                      onPress={() => toggleImageSelection(item)}
                    >
                      <Ionicons
                        name={
                          selectedImages.includes(item)
                            ? "checkmark-circle"
                            : "close-circle"
                        }
                        size={24}
                        color={
                          selectedImages.includes(item) ? COLORS.primary : "red"
                        }
                      />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      ) : (
        <View style={styles.emptyGroupsContainer}>
          <Ionicons name="folder-open" size={60} color={COLORS.secondary} />
          <Text style={styles.emptyGroupsText}>No groups created yet</Text>
        </View>
      )}

      {/* Fixed camera button */}
      <View style={styles.cameraButtonContainer}>
        {activeTab === "recents" && editMode && selectedImages.length > 0 ? (
          <TouchableOpacity
            style={styles.deleteSelectedButton}
            onPress={deleteSelectedImages}
          >
            <Text style={styles.deleteSelectedText}>
              Delete Selected ({selectedImages.length})
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.cameraButton}
            onPress={() => navigation.navigate("Camera" as never)}
          >
            <Ionicons name="camera" size={36} color="white" />
          </TouchableOpacity>
        )}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  // ...existing code...

  tabContainer: {
    flexDirection: "row",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginRight: 10,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 16,
    fontFamily: FONT.bold,
    color: COLORS.secondary,
  },
  activeTabText: {
    color: COLORS.primary,
  },
  emptyGroupsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 70,
  },
  emptyGroupsText: {
    fontSize: 18,
    color: COLORS.foreground,
    fontFamily: FONT.regular,
    marginTop: 20,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.card,
    borderRadius: 15,
  },

  editButtonText: {
    color: COLORS.primary,
    fontFamily: FONT.bold,
    fontSize: 14,
  },

  imageContainer: {
    margin: 2,
    width: (Dimensions.get("window").width - 40) / 3,
    height: (Dimensions.get("window").width - 40) / 3,
    borderRadius: 6,
    position: "relative",
    overflow: "hidden",
  },

  image: {
    width: "100%",
    height: "100%",
    borderRadius: 6,
  },

  deleteButton: {
    position: "absolute",
    top: 5,
    left: 5,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },

  selectedDeleteButton: {
    backgroundColor: "rgba(255,255,255,0.9)",
  },

  deleteSelectedButton: {
    backgroundColor: COLORS.secondary,
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  deleteSelectedText: {
    color: "white",
    fontFamily: FONT.bold,
    fontSize: 16,
  },

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
  fixedContent: {
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  galleryHeader: {
    fontSize: 20,
    fontFamily: FONT.bold,
    color: COLORS.primary,
    marginBottom: 10,
  },
  galleryContent: {
    paddingHorizontal: 20,
  },
  emptyGallery: {
    alignItems: "center",
    justifyContent: "center",
    height: 200,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.secondary,
    marginTop: 10,
    fontFamily: FONT.regular,
  },
  helpButton: {
    position: "absolute",
    top: 50,
    left: 10,
    zIndex: 1,
    padding: 5, // Add some padding to make the touch target larger
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 1,
  },
});

export default HomeScreen;
