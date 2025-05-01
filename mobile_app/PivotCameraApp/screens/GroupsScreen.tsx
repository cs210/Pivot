import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Image,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, GRADIENTS, STYLES, FONT } from "../theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useNavigation,
  useIsFocused,
  NavigationProp,
} from "@react-navigation/native";
import { ImageGroup } from "../types";
import { GroupStorage } from "../utils/groupStorage";
import { GroupsScreenNavigationProp } from "../navigation/types";

const SCREEN_WIDTH = Dimensions.get("window").width;

const GroupsScreen: React.FC = () => {
  const navigation = useNavigation<GroupsScreenNavigationProp>();
  const isFocused = useIsFocused();
  const [groups, setGroups] = useState<ImageGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [editingGroup, setEditingGroup] = useState<ImageGroup | null>(null);

  useEffect(() => {
    if (isFocused) {
      loadGroups();
    }
  }, [isFocused]);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const loadedGroups = await GroupStorage.loadGroups();
      setGroups(loadedGroups);
    } catch (error) {
      console.error("Error loading groups:", error);
      Alert.alert("Error", "Failed to load groups");
    } finally {
      setLoading(false);
    }
  };

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

  const handleEditGroup = (group: ImageGroup) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDescription(group.description);
    setModalVisible(true);
  };

  const openGroup = (group: ImageGroup) => {
    navigation.navigate("GroupDetail", { groupId: group.id });
  };

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
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: COLORS.card, borderBottomColor: COLORS.border },
        ]}
      >
        <Text style={[styles.title, { color: COLORS.foreground }]}>
          Image Groups
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setEditingGroup(null);
            setGroupName("");
            setGroupDescription("");
            setModalVisible(true);
          }}
        >
          <Ionicons name="add" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Group List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading groups...</Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="folder-open-outline"
            size={60}
            color={COLORS.secondary}
          />
          <Text style={[styles.emptyText, { color: COLORS.foreground }]}>
            No groups created yet
          </Text>
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: COLORS.primary }]}
            onPress={() => setModalVisible(true)}
          >
            <Text
              style={[
                styles.createButtonText,
                { color: COLORS.primaryForeground },
              ]}
            >
              Create Group
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={groups}
          renderItem={renderGroupItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.groupsList}
        />
      )}

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
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontFamily: FONT.bold,
  },
  addButton: {
    padding: 8,
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
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    marginTop: 20,
    marginBottom: 30,
    fontFamily: FONT.regular,
  },
  createButton: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontFamily: FONT.bold,
  },
  groupsList: {
    padding: 10,
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
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  placeholderThumbnail: {
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.muted,
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
    width: SCREEN_WIDTH * 0.85,
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
});

export default GroupsScreen;
