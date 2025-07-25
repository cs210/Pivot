import React, { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import {
  useNavigation,
  useIsFocused,
  useRoute,
  RouteProp,
  NavigationProp,
} from "@react-navigation/native"; // Added useRoute, RouteProp
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
  Modal,
  TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, GRADIENTS, STYLES, FONT } from "../theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as FileSystem from "expo-file-system";
import { ImageGroup, RootStackParamList } from "../types"; // Added RootStackParamList
import { GroupStorage } from "../utils/groupStorage";
import { supabase } from "../utils/supabase"; // Import supabase client

// App.tsx or index.js (top of file)
import "react-native-url-polyfill/auto";
require("randombytes");
global.Buffer = require("buffer").Buffer;

// Define the type for the Home screen route parameters
type HomeScreenRouteProp = RouteProp<RootStackParamList, "Home">;

// Define a type for the project data we expect
interface Project {
  id: string;
  name: string;
  // Add other project fields if needed
}

const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const isFocused = useIsFocused();
  const route = useRoute<HomeScreenRouteProp>(); // Get route object
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true); // Keep this for image loading
  const [groupsLoading, setGroupsLoading] = useState(true);
  const IMAGE_SIZE = (Dimensions.get("window").width - 40) / 3;
  const [showHowItWorks, setShowHowItWorks] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("recents");

  // Group related states
  const [groups, setGroups] = useState<ImageGroup[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [editingGroup, setEditingGroup] = useState<ImageGroup | null>(null);

  // Add this new state for the add to group modal
  const [addToGroupModalVisible, setAddToGroupModalVisible] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // State for fetched projects
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false); // Loading state for projects

  // track auth state
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    fetchUser();
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setCurrentUser(session?.user ?? null);
      }
    );
    return () => listener?.subscription.unsubscribe();
  }, []);

  // Load content based on active tab
  useEffect(() => {
    if (isFocused) {
      if (activeTab === "recents") {
        loadImages();
      } else if (activeTab === "groups") {
        loadGroups();
      }
    }
  }, [isFocused, activeTab]);

  // New useEffect to fetch project details when projectIds are available
  useEffect(() => {
    const projectIds = route.params?.projectIds;
    if (projectIds && projectIds.length > 0) {
      console.log("Received project IDs:", projectIds);
      fetchProjectDetails(projectIds);
    } else {
      // No project IDs passed: fetch for current user on initial mount
      (async () => {
        try {
          const { data: userData, error: userErr } =
            await supabase.auth.getUser();
          if (userErr || !userData.user) {
            setUserProjects([]);
            return;
          }
          const userId = userData.user.id;
          const { data: projectsData, error: projectsErr } = await supabase
            .from("projects")
            .select("id")
            .eq("user_id", userId);
          if (projectsErr || !projectsData) {
            setUserProjects([]);
            return;
          }
          const fetchedIds = projectsData.map((p: any) => p.id);
          console.log("Fetched project IDs on mount:", fetchedIds);
          fetchProjectDetails(fetchedIds);
        } catch (err) {
          console.error("Error fetching initial project IDs:", err);
          setUserProjects([]);
        }
      })();
    }
  }, [route.params?.projectIds]); // Re-run when projectIds change

  // Function to fetch project details from Supabase
  const fetchProjectDetails = async (ids: string[]) => {
    setProjectsLoading(true);
    setUserProjects([]); // Clear previous projects
    try {
      // Replace 'projects' with your actual projects table name
      // Replace 'id' and 'name' with your actual column names if different
      const { data, error } = await supabase
        .from("projects") // <<< Your projects table name
        .select("id, name") // <<< Columns to fetch (id and name)
        .in("id", ids); // Fetch projects whose 'id' is in the provided array

      if (error) {
        console.error("Error fetching project details:", error);
        Alert.alert("Error", "Could not fetch project details.");
        setUserProjects([]); // Ensure projects are empty on error
      } else if (data) {
        console.log("Fetched project details:", data);
        setUserProjects(data as Project[]); // Set the fetched projects
      } else {
        setUserProjects([]); // Handle case where data is null
      }
    } catch (err) {
      console.error("Unexpected error fetching projects:", err);
      Alert.alert(
        "Error",
        "An unexpected error occurred while fetching projects."
      );
      setUserProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  };

  // Function to fetch and refresh user's projects
  const loadUserProjects = async () => {
    if (!currentUser) return;
    setProjectsLoading(true);
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .eq("user_id", currentUser.id);
      if (error) throw error;
      setUserProjects(data as Project[]);
    } catch (err) {
      console.error("Error loading user projects:", err);
    } finally {
      setProjectsLoading(false);
    }
  };

  // Subscribe to new project insertions for real-time refresh
  useEffect(() => {
    if (!currentUser) return;
    loadUserProjects();
    const channel = supabase
      .channel("projects_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "projects",
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => {
          console.log("Realtime subscription: detected new project insertion");
          loadUserProjects();
        }
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [currentUser]);

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

  // Load groups function
  const loadGroups = async () => {
    try {
      setGroupsLoading(true);
      const loadedGroups = await GroupStorage.loadGroups();
      setGroups(loadedGroups);
    } catch (error) {
      console.error("Error loading groups:", error);
      Alert.alert("Error", "Failed to load groups");
    } finally {
      setGroupsLoading(false);
    }
  };

  // Create/Edit group function
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert("Error", "Group name is required");
      return;
    }

    try {
      if (editingGroup) {
        // Update existing group
        const updatedGroup = {
          ...editingGroup,
          name: groupName,
          description: groupDescription,
        };
        await GroupStorage.updateGroup(updatedGroup);
      } else {
        // Create new group
        await GroupStorage.createGroup(groupName, groupDescription);
      }

      // Reset form and close modal
      setGroupName("");
      setGroupDescription("");
      setEditingGroup(null);
      setModalVisible(false);

      // Reload groups
      await loadGroups();
    } catch (error) {
      console.error("Error creating group:", error);
      Alert.alert("Error", "Failed to create group");
    }
  };

  // Delete group function
  const handleDeleteGroup = (group: ImageGroup) => {
    Alert.alert(
      "Delete Group",
      `Are you sure you want to delete the group "${group.name}"? This won't delete the images.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await GroupStorage.deleteGroup(group.id);
              await loadGroups();
            } catch (error) {
              console.error("Error deleting group:", error);
              Alert.alert("Error", "Failed to delete group");
            }
          },
        },
      ]
    );
  };

  // Edit group function
  const handleEditGroup = (group: ImageGroup) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDescription(group.description);
    setModalVisible(true);
  };

  // Open group details
  const openGroup = (group: ImageGroup) => {
    // console.log("Opening group:", group);
    navigation.navigate("GroupDetail", {
      groupId: group.id,
      projects: userProjects,
    });
  };

  // Add this new function to handle adding selected images to a group
  const addSelectedImagesToGroup = async () => {
    if (!selectedGroupId || selectedImages.length === 0) return;

    try {
      await GroupStorage.addImagesToGroup(selectedGroupId, selectedImages);
      setSelectedImages([]);
      setAddToGroupModalVisible(false);
      setSelectedGroupId(null);
      setEditMode(false);
      Alert.alert("Success", "Images added to group");
    } catch (error) {
      console.error("Error adding images to group:", error);
      Alert.alert("Error", "Failed to add images to group");
    }
  };

  // Render a group item
  const renderGroupItem = ({ item }: { item: ImageGroup }) => {
    // Get the first image from the group to display as thumbnail
    const thumbnailUri = item.imageUris.length > 0 ? item.imageUris[0] : null;
    const imageCount = item.imageUris.length;

    return (
      <TouchableOpacity
        style={[styles.groupCard, STYLES.card]}
        onPress={() => openGroup(item)}
        activeOpacity={0.7}
      >
        <View style={styles.thumbnailContainer}>
          {thumbnailUri ? (
            <Image source={{ uri: thumbnailUri }} style={styles.thumbnail} />
          ) : (
            <View style={styles.placeholderThumbnail}>
              <Ionicons name="images" size={40} color={COLORS.secondary} />
            </View>
          )}
          <View style={styles.imageCountBadge}>
            <Text style={styles.imageCountText}>{imageCount}</Text>
          </View>
        </View>

        <View style={styles.groupInfo}>
          <Text style={styles.groupName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.groupDescription} numberOfLines={2}>
            {item.description || "No description"}
          </Text>
        </View>

        <View style={styles.groupActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditGroup(item)}
          >
            <Ionicons name="pencil" size={20} color={COLORS.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteGroup(item)}
          >
            <Ionicons name="trash-outline" size={20} color={COLORS.secondary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
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

      {/* Profile button in top right */}
      <TouchableOpacity
        style={styles.profileButton}
        onPress={() => {
          navigation.navigate(currentUser ? "Profile" : ("Auth" as never));
        }}
      >
        <Ionicons
          name="person-circle-outline"
          size={50}
          color={COLORS.primary}
        />
      </TouchableOpacity>

      <View style={styles.fixedContent}>
        {/* Logo and app name */}
        <View style={[styles.logoContainer, { alignSelf: "center" }]}>
          <Ionicons name="compass-outline" size={32} color={COLORS.primary} />
          <Text style={styles.logoText}>Pivot</Text>
        </View>

        {/* Display User Projects if available */}
        {projectsLoading ? (
          <ActivityIndicator
            color={COLORS.primary}
            style={{ marginVertical: 10 }}
          />
        ) : userProjects.length > 0 ? (
          <View style={styles.projectsContainer}>
            <Text style={styles.projectsHeader}>Your Projects:</Text>
            {userProjects.map((project) => (
              <Text key={project.id} style={styles.projectName}>
                - {project.name}
              </Text>
            ))}
          </View>
        ) : (
          // Optionally show a message if logged in but no projects, or hide if not logged in
          route.params?.projectIds &&
          route.params.projectIds.length === 0 && (
            <Text style={styles.noProjectsText}>
              No projects found for your account.
            </Text>
          )
        )}

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
        {activeTab === "recents" ? (
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
        ) : (
          <View style={styles.headerRow}>
            <Text style={styles.galleryHeader}>My Groups</Text>
            <TouchableOpacity
              style={styles.createGroupButton}
              onPress={() => {
                setEditingGroup(null);
                setGroupName("");
                setGroupDescription("");
                setModalVisible(true);
              }}
            >
              <Ionicons name="add-circle" size={20} color={COLORS.primary} />
              <Text
                style={[
                  styles.createGroupText,
                  { fontFamily: undefined, fontSize: 16, fontWeight: "600" },
                ]}
              >
                New Group
              </Text>
            </TouchableOpacity>
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
              key="recentsGrid"
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
        <View style={styles.galleryContainer}>
          {groupsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading groups...</Text>
            </View>
          ) : groups.length === 0 ? (
            <View style={styles.emptyGroupsContainer}>
              {/* <Ionicons name="folder-open" size={60} color={COLORS.secondary} /> */}
              <Text style={styles.emptyGroupsText}>No groups created yet</Text>
            </View>
          ) : (
            <FlatList
              key="groupsList"
              data={groups}
              renderItem={renderGroupItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.groupsList}
            />
          )}
        </View>
      )}

      {/* Fixed camera button */}
      <View style={styles.cameraButtonContainer}>
        {activeTab === "recents" && editMode && selectedImages.length > 0 ? (
          <View style={styles.editActionsContainer}>
            <TouchableOpacity
              style={styles.addToGroupButton}
              onPress={() => {
                // Load groups before showing modal
                loadGroups().then(() => {
                  setAddToGroupModalVisible(true);
                });
              }}
            >
              <Text style={styles.addToGroupText}>
                Add to Group ({selectedImages.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteSelectedButton}
              onPress={deleteSelectedImages}
            >
              <Text style={styles.deleteSelectedText}>
                Delete ({selectedImages.length})
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.cameraButton}
            onPress={() => navigation.navigate("Camera" as never)}
          >
            <Ionicons name="camera" size={36} color="white" />
          </TouchableOpacity>
        )}
      </View>

      {/* Create/Edit Group Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: COLORS.card }]}>
            <Text style={[styles.modalTitle, { color: COLORS.foreground }]}>
              {editingGroup ? "Edit Group" : "Create New Group"}
            </Text>

            <TextInput
              style={[styles.input, { borderColor: COLORS.border }]}
              placeholder="Group Name"
              value={groupName}
              onChangeText={setGroupName}
              placeholderTextColor={COLORS.secondary}
            />

            <TextInput
              style={[
                styles.input,
                { borderColor: COLORS.border, height: 100 },
              ]}
              placeholder="Description (optional)"
              value={groupDescription}
              onChangeText={setGroupDescription}
              multiline
              placeholderTextColor={COLORS.secondary}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { borderColor: COLORS.border }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={{ color: COLORS.primary }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: COLORS.primary },
                ]}
                onPress={handleCreateGroup}
              >
                <Text style={{ color: COLORS.primaryForeground }}>
                  {editingGroup ? "Save" : "Create"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add to Group Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addToGroupModalVisible}
        onRequestClose={() => setAddToGroupModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: COLORS.card }]}>
            <Text style={[styles.modalTitle, { color: COLORS.foreground }]}>
              Add to Group
            </Text>
            <Text style={styles.modalSubtitle}>
              Select a group to add {selectedImages.length} image
              {selectedImages.length !== 1 ? "s" : ""}
            </Text>

            {groupsLoading ? ( // Added loading check for consistency
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <FlatList
                // Add a special item for creating a new group
                data={[
                  ...groups,
                  { id: "create_new_group", name: "Create New Group" },
                ]}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  // Check if it's the special 'create new group' item
                  if (item.id === "create_new_group") {
                    return (
                      <TouchableOpacity
                        style={[
                          styles.createGroupFromModalButton,
                          { marginTop: 10 },
                        ]} // Reuse style
                        onPress={() => {
                          setAddToGroupModalVisible(false); // Close current modal
                          setEditingGroup(null);
                          setGroupName("");
                          setGroupDescription("");
                          setModalVisible(true); // Open create group modal
                        }}
                      >
                        <Text style={styles.createGroupFromModalText}>
                          <Ionicons
                            name="add-circle-outline"
                            size={16}
                            color={COLORS.primaryForeground}
                          />{" "}
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                  // Otherwise, render a regular group item
                  return (
                    <TouchableOpacity
                      style={[
                        styles.groupSelectItem,
                        selectedGroupId === item.id && styles.selectedGroupItem,
                      ]}
                      onPress={() => setSelectedGroupId(item.id)}
                    >
                      <View style={styles.groupSelectInfo}>
                        <Text style={styles.groupSelectName}>{item.name}</Text>
                        <Text style={styles.groupSelectCount}>
                          {item.imageUris.length} image
                          {item.imageUris.length !== 1 ? "s" : ""}
                        </Text>
                      </View>
                      {selectedGroupId === item.id && (
                        <Ionicons
                          name="checkmark-circle"
                          size={24}
                          color={COLORS.primary}
                        />
                      )}
                    </TouchableOpacity>
                  );
                }}
                contentContainerStyle={styles.groupSelectList}
              />
            )}
            {/* Removed the standalone button from here */}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { borderColor: COLORS.border }]}
                onPress={() => setAddToGroupModalVisible(false)}
              >
                <Text style={{ color: COLORS.primary }}>Cancel</Text>
              </TouchableOpacity>

              {groups.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    {
                      backgroundColor: selectedGroupId
                        ? COLORS.primary
                        : COLORS.muted,
                    },
                  ]}
                  disabled={!selectedGroupId}
                  onPress={addSelectedImagesToGroup}
                >
                  <Text style={{ color: COLORS.primaryForeground }}>
                    Add to Group
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
  // ...existing styles...

  // Group-related styles
  createGroupButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: COLORS.card,
    borderRadius: 15,
  },
  createGroupText: {
    color: COLORS.primary,
    fontFamily: FONT.bold,
    fontSize: 14,
    marginLeft: 5,
  },
  groupsList: {
    padding: 15,
    paddingBottom: 120, // Increased padding to avoid overlap with camera button and create group button in list
  },
  groupCard: {
    flexDirection: "row",
    marginBottom: 15,
    padding: 15,
    borderRadius: 10,
  },
  thumbnailContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: "hidden",
    marginRight: 15,
    backgroundColor: COLORS.muted,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  placeholderThumbnail: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  imageCountBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  imageCountText: {
    color: COLORS.primaryForeground,
    fontFamily: FONT.bold,
    fontSize: 12,
  },
  groupInfo: {
    flex: 1,
    justifyContent: "center",
  },
  groupName: {
    fontSize: 18,
    fontFamily: FONT.bold,
    marginBottom: 5,
    color: COLORS.foreground,
  },
  groupDescription: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.secondary,
  },
  groupActions: {
    justifyContent: "space-around",
    padding: 5,
  },
  actionButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    width: "85%",
    padding: 20,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: FONT.bold,
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    width: "100%",
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 15,
    fontFamily: FONT.regular,
    color: COLORS.foreground,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 15,
    color: COLORS.secondary,
    fontSize: 16,
    fontFamily: FONT.regular,
  },

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
    flex: 1, // Allow the gallery to expand
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
    paddingBottom: 100, // Add padding to avoid overlap with camera button
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
  profileButton: {
    position: "absolute",
    top: 50,
    right: 10,
    zIndex: 1,
    padding: 5, // Add some padding to make the touch target larger
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 1,
  },
  editActionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "80%",
  },
  addToGroupButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  addToGroupText: {
    color: "white",
    fontFamily: FONT.bold,
    fontSize: 16,
  },
  modalSubtitle: {
    fontSize: 16,
    fontFamily: FONT.regular,
    marginBottom: 20,
    textAlign: "center",
    color: COLORS.secondary,
  },
  noGroupsContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  noGroupsText: {
    fontSize: 16,
    color: COLORS.secondary,
    marginTop: 10,
    fontFamily: FONT.regular,
  },
  createGroupFromModalButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 20,
  },
  createGroupFromModalText: {
    color: COLORS.primaryForeground,
    fontFamily: FONT.bold,
    fontSize: 16,
    textAlign: "center", // Center text within the button
  },
  groupSelectItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  selectedGroupItem: {
    backgroundColor: COLORS.muted,
  },
  groupSelectInfo: {
    flexDirection: "column",
  },
  groupSelectName: {
    fontSize: 16,
    fontFamily: FONT.bold,
    color: COLORS.foreground,
  },
  groupSelectCount: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.secondary,
  },
  groupSelectList: {
    paddingBottom: 20, // Restore original padding
  },

  // Add styles for the projects display
  projectsContainer: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: "rgba(255, 255, 255, 0.1)", // Semi-transparent background
    borderRadius: 8,
  },
  projectsHeader: {
    fontSize: 16,
    fontFamily: FONT.bold,
    color: COLORS.primary,
    marginBottom: 5,
  },
  projectName: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.foreground,
    marginLeft: 10, // Indent project names
    marginBottom: 3,
  },
  noProjectsText: {
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.secondary,
    textAlign: "center",
    marginVertical: 10,
  },
});

export default HomeScreen;
