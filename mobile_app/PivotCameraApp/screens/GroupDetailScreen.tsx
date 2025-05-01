import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, GRADIENTS, STYLES, FONT } from "../theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as FileSystem from "expo-file-system";
import { ImageGroup } from "../types";
import { GroupStorage } from "../utils/groupStorage";
import { supabase } from "../utils/supabase"; // Import the centralized Supabase client

// Define a type for the project data we expect
interface Project {
  id: string;
  name: string;
  // Add other project fields if needed
}

type GroupDetailParams = {
  GroupDetail: {
    groupId: string;
    projects?: Project[]; // Adjust this type based on your actual project type
  };
};

const GroupDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<GroupDetailParams, "GroupDetail">>();
  const { groupId, projects } = route.params;

  // Log projects for debugging
  useEffect(() => {
    if (projects) {
      console.log("Projects received in GroupDetail:", projects);
    }
  }, [projects]);

  const [group, setGroup] = useState<ImageGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [addImagesModalVisible, setAddImagesModalVisible] = useState(false);
  const [availableImages, setAvailableImages] = useState<string[]>([]);
  const [selectedAvailableImages, setSelectedAvailableImages] = useState<
    string[]
  >([]);
  const [loadingAvailableImages, setLoadingAvailableImages] = useState(false);
  const [publishModalVisible, setPublishModalVisible] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );

  const IMAGE_SIZE = (Dimensions.get("window").width - 40) / 3;

  useEffect(() => {
    loadGroup();
  }, [groupId]);

  const loadGroup = async () => {
    try {
      setLoading(true);
      const loadedGroup = await GroupStorage.getGroupById(groupId);
      if (loadedGroup) {
        setGroup(loadedGroup);
      } else {
        Alert.alert("Error", "Group not found");
        navigation.goBack();
      }
    } catch (error) {
      console.error("Error loading group:", error);
      Alert.alert("Error", "Failed to load group");
    } finally {
      setLoading(false);
    }
  };

  const toggleEditMode = () => {
    setEditMode(!editMode);
    if (editMode) {
      setSelectedImages([]);
    }
  };

  const toggleImageSelection = (uri: string) => {
    if (selectedImages.includes(uri)) {
      setSelectedImages(selectedImages.filter((img) => img !== uri));
    } else {
      setSelectedImages([...selectedImages, uri]);
    }
  };

  const toggleAvailableImageSelection = (uri: string) => {
    if (selectedAvailableImages.includes(uri)) {
      setSelectedAvailableImages(
        selectedAvailableImages.filter((img) => img !== uri)
      );
    } else {
      setSelectedAvailableImages([...selectedAvailableImages, uri]);
    }
  };

  const removeSelectedImages = async () => {
    if (!group || selectedImages.length === 0) return;

    try {
      const updatedGroup = await GroupStorage.removeImagesFromGroup(
        groupId,
        selectedImages
      );
      setGroup(updatedGroup);
      setSelectedImages([]);
      Alert.alert("Success", "Images removed from group");
    } catch (error) {
      console.error("Error removing images:", error);
      Alert.alert("Error", "Failed to remove images");
    }
  };

  const openAddImagesModal = async () => {
    try {
      setLoadingAvailableImages(true);
      setAddImagesModalVisible(true);

      // Get all images from the device
      const dir = `${FileSystem.documentDirectory}room_scanner/`;
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) {
        setAvailableImages([]);
        return;
      }

      const files = await FileSystem.readDirectoryAsync(dir);
      const jpgs = files.filter((f) => f.match(/\.(jpe?g|png)$/));
      const allImages = jpgs.map((f) => dir + f);

      // Filter out images that are already in the group
      const groupImages = group?.imageUris || [];
      const newAvailableImages = allImages.filter(
        (uri) => !groupImages.includes(uri)
      );

      setAvailableImages(newAvailableImages);
    } catch (error) {
      console.error("Error loading available images:", error);
      Alert.alert("Error", "Failed to load available images");
    } finally {
      setLoadingAvailableImages(false);
    }
  };

  const addSelectedImagesToGroup = async () => {
    if (!group || selectedAvailableImages.length === 0) return;

    try {
      const updatedGroup = await GroupStorage.addImagesToGroup(
        groupId,
        selectedAvailableImages
      );
      setGroup(updatedGroup);
      setSelectedAvailableImages([]);
      setAddImagesModalVisible(false);
      Alert.alert("Success", "Images added to group");
    } catch (error) {
      console.error("Error adding images:", error);
      Alert.alert("Error", "Failed to add images");
    }
  };

  const handlePublishToWeb = () => {
    // Open the modal to select a project
    setPublishModalVisible(true);
  };

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
  };

  const handlePublishConfirm = async () => {
    if (!selectedProjectId) {
      Alert.alert("Error", "Please select a project first");
      return;
    }

    if (!group || group.imageUris.length === 0) {
      Alert.alert("Error", "No images to upload");
      return;
    }

    try {
      setPublishModalVisible(false);

      // Show loading indicator
      setLoading(true);

      // Get the selected project
      const selectedProject = projects?.find((p) => p.id === selectedProjectId);

      // Check if the user is authenticated
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userData.user) {
        throw new Error(
          "You must be logged in to publish images. Error: " +
            userError?.message
        );
      }

      console.log("Authenticated as user:", userData.user.id);

      // Upload all images in the group to Supabase
      await uploadGroupImagesToSupabase(group.imageUris, selectedProjectId);

      Alert.alert(
        "Success",
        `Published ${group.imageUris.length} images to project "${selectedProject?.name}"`
      );
    } catch (error) {
      console.error("Error publishing images:", error);
      // Log the detailed error
      if (error instanceof Error) {
        console.error("Error details:", error.message);
      } else {
        console.error("Unknown error:", JSON.stringify(error));
      }

      // Format the error message for display
      let errorMessage = "Unknown error";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "object" && error !== null) {
        // Try to extract more detailed error message from Supabase error object
        errorMessage = JSON.stringify(error);
      }

      Alert.alert("Error", `Failed to publish images: ${errorMessage}`);
    } finally {
      setLoading(false);
      setSelectedProjectId(null);
    }
  };

  // Function to upload all images in a group to Supabase
  const uploadGroupImagesToSupabase = async (
    imageUris: string[],
    projectId: string
  ) => {
    if (imageUris.length === 0) return;

    const uploadProgress = (current: number, total: number) => {
      console.log(`Uploading image ${current} of ${total}`);
    };

    try {
      // First verify we have a valid session
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error(
          "No active session. Please login first: " +
            (sessionError?.message || "")
        );
      }

      console.log("Using session for user:", session.user.id);

      // Validate user has access to this project
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("id, name")
        .eq("id", projectId)
        .single();

      if (projectError) {
        if (projectError.code === "PGRST116") {
          throw new Error(
            `Project not found or you don't have access to this project`
          );
        }
        throw new Error(
          "Error checking project access: " + projectError.message
        );
      }

      if (!projectData) {
        throw new Error(
          "Project not found or you don't have permission to access it"
        );
      }

      console.log("Verified access to project:", projectData.name);

      for (let i = 0; i < imageUris.length; i++) {
        const imageUri = imageUris[i];

        // Extract filename from URI
        const fileName = imageUri.split("/").pop() || `image_${Date.now()}.jpg`;

        // Define storage path (same format as the web app)
        const filePath = `${projectId}/${fileName}`;

        uploadProgress(i + 1, imageUris.length);

        // Get file info
        const fileInfo = await FileSystem.getInfoAsync(imageUri);
        if (!fileInfo.exists) {
          console.error(`File does not exist: ${imageUri}`);
          continue;
        }

        // Read the file as base64
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Convert base64 to blob
        const blob = await fetch(`data:image/jpeg;base64,${base64}`).then((r) =>
          r.blob()
        );

        console.log(`Uploading file: ${fileName} to path: ${filePath}`);

        // Upload to Supabase storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("raw-images") // Must match the bucket name in Supabase
          .upload(filePath, blob, {
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          throw uploadError;
        }

        console.log("File uploaded successfully:", uploadData?.path);

        // Insert record into database with all required fields
        const { data, error } = await supabase
          .from("raw_images")
          .insert([
            {
              filename: fileName,
              storage_path: uploadData.path,
              project_id: projectId,
              folder_id: null, // No folder initially
              user_id: session.user.id, // Always use the session user ID
              content_type: "image/jpeg", // Default to JPEG
              size_bytes: fileInfo.size || 0,
              metadata: {
                source: "mobile_app",
                group_name: group?.name || "",
                upload_date: new Date().toISOString(),
              },
            },
          ])
          .select();

        if (error) {
          console.error("Database insert error:", error);
          throw new Error(`Database insert error: ${error.message}`);
        }

        console.log("Image record created in database:", data);
      }
    } catch (error) {
      console.error("Error in uploadGroupImagesToSupabase:", error);
      throw error;
    }
  };

  if (loading) {
    return (
      <LinearGradient colors={GRADIENTS.cyber} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading group...</Text>
        </View>
      </LinearGradient>
    );
  }

  if (!group) {
    return (
      <LinearGradient colors={GRADIENTS.cyber} style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={60} color={COLORS.secondary} />
          <Text style={styles.errorText}>Group not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={GRADIENTS.cyber} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{group.name}</Text>
        <TouchableOpacity style={styles.editButton} onPress={toggleEditMode}>
          <Text style={styles.editButtonText}>
            {editMode ? "Done" : "Edit"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Description */}
      {group.description ? (
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionText}>{group.description}</Text>
        </View>
      ) : null}

      {/* Projects Section - Display when available */}
      {projects && projects.length > 0 && (
        <View style={styles.projectsContainer}>
          <Text style={styles.projectsTitle}>Available Projects:</Text>
          <FlatList
            horizontal
            data={projects}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.projectsListContent}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.projectItem}>
                <Text style={styles.projectItemText}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Image count and actions */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          {group.imageUris.length}{" "}
          {group.imageUris.length === 1 ? "image" : "images"}
        </Text>
        <View style={styles.actionsContainer}>
          {!editMode && (
            <>
              <TouchableOpacity
                style={styles.publishButton}
                onPress={handlePublishToWeb}
              >
                <Ionicons
                  name="cloud-upload"
                  size={18}
                  color={COLORS.primaryForeground}
                />
                <Text style={styles.publishButtonText}>
                  Publish to Folder on Web
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addImagesButton}
                onPress={openAddImagesModal}
              >
                <Ionicons name="add" size={20} color={COLORS.primary} />
                <Text style={styles.addImagesText}>Add Images</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Gallery */}
      <FlatList
        key="groupDetailGrid"
        data={group.imageUris}
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
            <Text style={styles.emptyText}>No images in this group</Text>
            <TouchableOpacity
              style={styles.addFirstImageButton}
              onPress={openAddImagesModal}
            >
              <Text style={styles.addFirstImageText}>Add Images</Text>
            </TouchableOpacity>
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
                  styles.selectButton,
                  selectedImages.includes(item) && styles.selectedButton,
                ]}
                onPress={() => toggleImageSelection(item)}
              >
                <Ionicons
                  name={
                    selectedImages.includes(item)
                      ? "checkmark-circle"
                      : "ellipse-outline"
                  }
                  size={24}
                  color={
                    selectedImages.includes(item)
                      ? COLORS.primary
                      : COLORS.foreground
                  }
                />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )}
      />

      {/* Bottom action bar - Only shown in edit mode with selections */}
      {editMode && selectedImages.length > 0 && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={removeSelectedImages}
          >
            <Text style={styles.removeButtonText}>
              Remove Selected ({selectedImages.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Add Images Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addImagesModalVisible}
        onRequestClose={() => setAddImagesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Images to Group</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setAddImagesModalVisible(false);
                  setSelectedAvailableImages([]);
                }}
              >
                <Ionicons name="close" size={24} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            {loadingAvailableImages ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading images...</Text>
              </View>
            ) : availableImages.length === 0 ? (
              <View style={styles.emptyGallery}>
                <Ionicons
                  name="images-outline"
                  size={48}
                  color={COLORS.secondary}
                />
                <Text style={styles.emptyText}>No new images available</Text>
              </View>
            ) : (
              <>
                <Text style={styles.modalSubtitle}>
                  Select images to add to "{group.name}"
                </Text>
                <FlatList
                  key="availableImagesGrid"
                  data={availableImages}
                  keyExtractor={(uri) => uri}
                  numColumns={3}
                  contentContainerStyle={styles.galleryContent}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      activeOpacity={0.6}
                      onPress={() => toggleAvailableImageSelection(item)}
                      style={styles.imageContainer}
                    >
                      <Image source={{ uri: item }} style={styles.image} />
                      <TouchableOpacity
                        style={[
                          styles.selectButton,
                          selectedAvailableImages.includes(item) &&
                            styles.selectedButton,
                        ]}
                        onPress={() => toggleAvailableImageSelection(item)}
                      >
                        <Ionicons
                          name={
                            selectedAvailableImages.includes(item)
                              ? "checkmark-circle"
                              : "ellipse-outline"
                          }
                          size={24}
                          color={
                            selectedAvailableImages.includes(item)
                              ? COLORS.primary
                              : COLORS.foreground
                          }
                        />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  )}
                />

                {selectedAvailableImages.length > 0 && (
                  <TouchableOpacity
                    style={styles.addToGroupButton}
                    onPress={addSelectedImagesToGroup}
                  >
                    <Text style={styles.addToGroupText}>
                      Add Selected ({selectedAvailableImages.length}) to Group
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Publish to Web Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={publishModalVisible}
        onRequestClose={() => setPublishModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Publish to Web Folder</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setPublishModalVisible(false);
                  setSelectedProjectId(null);
                }}
              >
                <Ionicons name="close" size={24} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.publishModalContent}>
              <Text style={styles.modalSubtitle}>
                Select a project to publish images from "{group.name}"
              </Text>

              {!projects || projects.length === 0 ? (
                <View style={styles.emptyGallery}>
                  <Ionicons
                    name="folder-outline"
                    size={48}
                    color={COLORS.secondary}
                  />
                  <Text style={styles.emptyText}>No projects available</Text>
                </View>
              ) : (
                <FlatList
                  data={projects}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.projectsListVertical}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.projectListItem,
                        selectedProjectId === item.id &&
                          styles.projectListItemSelected,
                      ]}
                      onPress={() => handleProjectSelect(item.id)}
                    >
                      <View style={styles.projectListItemContent}>
                        <Ionicons
                          name="folder"
                          size={24}
                          color={
                            selectedProjectId === item.id
                              ? COLORS.primaryForeground
                              : COLORS.primary
                          }
                        />
                        <Text
                          style={[
                            styles.projectListItemText,
                            selectedProjectId === item.id &&
                              styles.projectListItemTextSelected,
                          ]}
                        >
                          {item.name}
                        </Text>
                      </View>
                      <Ionicons
                        name={
                          selectedProjectId === item.id
                            ? "checkmark-circle"
                            : "ellipse-outline"
                        }
                        size={24}
                        color={
                          selectedProjectId === item.id
                            ? COLORS.primaryForeground
                            : COLORS.primary
                        }
                      />
                    </TouchableOpacity>
                  )}
                />
              )}

              {projects && projects.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.publishConfirmButton,
                    !selectedProjectId && styles.publishConfirmButtonDisabled,
                  ]}
                  onPress={handlePublishConfirm}
                  disabled={!selectedProjectId}
                >
                  <Text style={styles.publishConfirmButtonText}>
                    Publish to Selected Project
                  </Text>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: FONT.bold,
    color: COLORS.foreground,
    flex: 1,
    textAlign: "center",
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
  descriptionContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  descriptionText: {
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.foreground,
    opacity: 0.8,
  },
  statsContainer: {
    flexDirection: "column",
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 10,
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  publishButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 15,
    justifyContent: "center",
  },
  publishButtonText: {
    color: COLORS.primaryForeground,
    fontFamily: FONT.bold,
    fontSize: 14,
    marginLeft: 5,
  },
  statsText: {
    fontSize: 16,
    fontFamily: FONT.bold,
    color: COLORS.primary,
  },
  galleryContent: {
    padding: 15,
    paddingBottom: 100, // Extra padding at the bottom
  },
  imageContainer: {
    margin: 2,
    width: (Dimensions.get("window").width - 40) / 3,
    height: (Dimensions.get("window").width - 40) / 3,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  selectButton: {
    position: "absolute",
    top: 5,
    right: 5,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedButton: {
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.8)",
    padding: 15,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  removeButton: {
    backgroundColor: COLORS.secondary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    width: "80%",
  },
  removeButtonText: {
    color: "white",
    fontFamily: FONT.bold,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 50,
  },
  loadingText: {
    marginTop: 15,
    color: COLORS.foreground,
    fontSize: 16,
    fontFamily: FONT.regular,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 50,
  },
  errorText: {
    marginTop: 15,
    color: COLORS.foreground,
    fontSize: 20,
    fontFamily: FONT.bold,
    marginBottom: 20,
  },
  backButtonText: {
    color: COLORS.primary,
    fontFamily: FONT.bold,
    fontSize: 16,
  },
  emptyGallery: {
    alignItems: "center",
    justifyContent: "center",
    height: 300,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.foreground,
    marginTop: 15,
    fontFamily: FONT.regular,
  },
  addImagesButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  addImagesText: {
    color: COLORS.primary,
    fontFamily: FONT.bold,
    fontSize: 14,
    marginLeft: 5,
  },
  addFirstImageButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 20,
  },
  addFirstImageText: {
    color: COLORS.primaryForeground,
    fontFamily: FONT.bold,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalContent: {
    flex: 1,
    backgroundColor: COLORS.background,
    marginTop: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: FONT.bold,
    color: COLORS.foreground,
  },
  modalCloseButton: {
    padding: 5,
  },
  modalSubtitle: {
    fontSize: 16,
    fontFamily: FONT.regular,
    color: COLORS.foreground,
    opacity: 0.8,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
  },
  addToGroupButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    margin: 20,
    alignItems: "center",
  },
  addToGroupText: {
    color: COLORS.primaryForeground,
    fontFamily: FONT.bold,
    fontSize: 16,
  },
  projectsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  projectsTitle: {
    fontSize: 18,
    fontFamily: FONT.bold,
    color: COLORS.foreground,
    marginBottom: 10,
  },
  projectsListContent: {
    paddingVertical: 10,
  },
  projectItem: {
    backgroundColor: COLORS.card,
    padding: 10,
    borderRadius: 8,
    marginRight: 10,
  },
  projectItemText: {
    color: COLORS.primary,
    fontFamily: FONT.bold,
    fontSize: 14,
  },
  publishModalContent: {
    flex: 1,
    padding: 20,
  },
  projectsListVertical: {
    paddingVertical: 10,
  },
  projectListItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.card,
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  projectListItemSelected: {
    backgroundColor: COLORS.primary,
  },
  projectListItemContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  projectListItemText: {
    color: COLORS.primary,
    fontFamily: FONT.bold,
    fontSize: 16,
    marginLeft: 10,
  },
  projectListItemTextSelected: {
    color: COLORS.primaryForeground,
  },
  publishConfirmButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  publishConfirmButtonDisabled: {
    backgroundColor: COLORS.secondary,
  },
  publishConfirmButtonText: {
    color: COLORS.primaryForeground,
    fontFamily: FONT.bold,
    fontSize: 16,
  },
});

export default GroupDetailScreen;
