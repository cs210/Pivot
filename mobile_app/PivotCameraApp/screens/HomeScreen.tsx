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
import { ImageGroup } from "../types";
import { GroupStorage } from "../utils/groupStorage";
import { HomeScreenNavigationProp } from "../navigation/types";

const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groups, setGroups] = useState<ImageGroup[]>([]);
  const IMAGE_SIZE = (Dimensions.get("window").width - 40) / 3;
  const [showHowItWorks, setShowHowItWorks] = useState(true);
  const [activeTab, setActiveTab] = useState("recent"); // 'recent' or 'groups'

  // Load images for Recent tab
  useEffect(() => {
    loadImages();
  }, []);

  // Load groups whenever the Groups tab is shown
  useEffect(() => {
    if (activeTab === "groups") {
      loadGroups();
    }
  }, [activeTab]);

  const loadImages = async () => {
    try {
      setLoading(true);
      const dir = `${FileSystem.documentDirectory}room_scanner/`;
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) {
        setImages([]);
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

  const loadGroups = async () => {
    try {
      setGroupsLoading(true);
      const loadedGroups = await GroupStorage.loadGroups();
      setGroups(loadedGroups);
    } catch (error) {
      console.error("Error loading groups:", error);
    } finally {
      setGroupsLoading(false);
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

        {showHowItWorks && (
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

        {/* Tab navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "recent" && [
                styles.activeTab,
                { borderColor: COLORS.primary },
              ],
            ]}
            onPress={() => setActiveTab("recent")}
          >
            <Ionicons
              name="images-outline"
              size={20}
              color={activeTab === "recent" ? COLORS.primary : COLORS.secondary}
            />
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "recent" ? COLORS.primary : COLORS.secondary,
                },
              ]}
            >
              Recent
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "groups" && [
                styles.activeTab,
                { borderColor: COLORS.primary },
              ],
            ]}
            onPress={() => setActiveTab("groups")}
          >
            <Ionicons
              name="folder-outline"
              size={20}
              color={activeTab === "groups" ? COLORS.primary : COLORS.secondary}
            />
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "groups" ? COLORS.primary : COLORS.secondary,
                },
              ]}
            >
              Groups
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Only the gallery is scrollable */}
      <View style={styles.galleryContainer}>
        {activeTab === "recent" ? (
          loading ? (
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
          )
        ) : /* Groups Tab Content */
        groupsLoading ? (
          <ActivityIndicator size="large" color={COLORS.primary} />
        ) : (
          <View style={styles.groupsContainer}>
            {groups.length === 0 ? (
              <View style={styles.emptyGallery}>
                <Ionicons
                  name="folder-outline"
                  size={48}
                  color={COLORS.secondary}
                />
                <Text style={styles.emptyText}>No groups created yet</Text>
                <TouchableOpacity
                  style={[
                    styles.createGroupButton,
                    { backgroundColor: COLORS.primary },
                  ]}
                  onPress={() => navigation.navigate("Groups")}
                >
                  <Text
                    style={{
                      color: COLORS.primaryForeground,
                      fontFamily: FONT.bold,
                    }}
                  >
                    Create Group
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={groups}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.groupsList}
                renderItem={({ item }) => {
                  // Display thumbnail from first image in group if available
                  const thumbnailUri =
                    item.imageUris.length > 0 ? item.imageUris[0] : null;

                  return (
                    <TouchableOpacity
                      style={[styles.groupCard, STYLES.card]}
                      onPress={() =>
                        navigation.navigate("GroupDetail", { groupId: item.id })
                      }
                    >
                      <View style={styles.groupCardContent}>
                        <View style={styles.groupThumbnail}>
                          {thumbnailUri ? (
                            <Image
                              source={{ uri: thumbnailUri }}
                              style={styles.thumbnailImage}
                            />
                          ) : (
                            <View
                              style={[
                                styles.placeholderThumbnail,
                                { backgroundColor: COLORS.muted },
                              ]}
                            >
                              <Ionicons
                                name="images"
                                size={24}
                                color={COLORS.secondary}
                              />
                            </View>
                          )}
                        </View>
                        <View style={styles.groupInfo}>
                          <Text
                            style={[
                              styles.groupName,
                              { color: COLORS.foreground },
                            ]}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                          <Text
                            style={[
                              styles.groupImageCount,
                              { color: COLORS.secondary },
                            ]}
                          >
                            {item.imageUris.length}{" "}
                            {item.imageUris.length === 1 ? "image" : "images"}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color={COLORS.secondary}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListFooterComponent={
                  <TouchableOpacity
                    style={[
                      styles.manageGroupsButton,
                      { borderColor: COLORS.primary },
                    ]}
                    onPress={() => navigation.navigate("Groups")}
                  >
                    <Text
                      style={{ color: COLORS.primary, fontFamily: FONT.bold }}
                    >
                      Manage Groups
                    </Text>
                  </TouchableOpacity>
                }
              />
            )}
          </View>
        )}
      </View>

      {/* Fixed camera button */}
      <View style={styles.cameraButtonContainer}>
        <TouchableOpacity
          style={styles.cameraButton}
          onPress={() => navigation.navigate("Camera")}
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
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "transparent",
  },
  activeTab: {
    backgroundColor: "white",
  },
  tabText: {
    marginLeft: 5,
    fontSize: 16,
    fontFamily: FONT.bold,
  },
  groupsContainer: {
    flex: 1,
    width: "100%",
  },
  groupsList: {
    paddingHorizontal: 20,
  },
  groupCard: {
    marginBottom: 15,
    padding: 15,
    borderRadius: 10,
  },
  groupCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  groupThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 6,
    overflow: "hidden",
    marginRight: 12,
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  placeholderThumbnail: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontFamily: FONT.bold,
    marginBottom: 4,
  },
  groupImageCount: {
    fontSize: 14,
    fontFamily: FONT.regular,
  },
  createGroupButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 15,
  },
  manageGroupsButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    marginTop: 15,
    marginBottom: 30,
  },
});

export default HomeScreen;
