import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, GRADIENTS, STYLES, FONT } from "../theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useNavigation,
  useRoute,
  useIsFocused,
} from "@react-navigation/native";
import { ImageGroup } from "../types";
import { GroupStorage } from "../utils/groupStorage";
import * as FileSystem from "expo-file-system";
import {
  GroupDetailScreenNavigationProp,
  GroupDetailScreenRouteProp,
} from "../navigation/types";

const SCREEN_WIDTH = Dimensions.get("window").width;
const IMAGE_WIDTH = (SCREEN_WIDTH - 50) / 3;

const GroupDetailScreen: React.FC = () => {
  const navigation = useNavigation<GroupDetailScreenNavigationProp>();
  const route = useRoute<GroupDetailScreenRouteProp>();
  const isFocused = useIsFocused();
  const { groupId } = route.params;

  const [group, setGroup] = useState<ImageGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [allImages, setAllImages] = useState<string[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  useEffect(() => {
    if (isFocused) {
      loadGroup();
    }
  }, [isFocused, groupId]);

  const loadGroup = async () => {
    setLoading(true);
    try {
      const groups = await GroupStorage.loadGroups();
      const foundGroup = groups.find((g) => g.id === groupId);

      if (foundGroup) {
        setGroup(foundGroup);
        setImages(foundGroup.imageUris);
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

  const loadAllImages = async () => {
    setLoadingGallery(true);
    try {
      const dirPath = `${FileSystem.documentDirectory}room_scanner/`;
      const dirInfo = await FileSystem.getInfoAsync(dirPath);

      if (!dirInfo.exists) {
        setAllImages([]);
        return;
      }

      const files = await FileSystem.readDirectoryAsync(dirPath);
      const imageFiles = files.filter(
        (file) =>
          file.endsWith(".jpg") ||
          file.endsWith(".jpeg") ||
          file.endsWith(".png")
      );

      // Map filenames to full URIs
      const imageUris = imageFiles.map((file) => `${dirPath}${file}`);

      // Filter out images already in the group
      const availableImages = imageUris.filter((uri) => !images.includes(uri));
      setAllImages(availableImages);
    } catch (error) {
      console.error("Error loading all images:", error);
      Alert.alert("Error", "Failed to load available images");
    } finally {
      setLoadingGallery(false);
    }
  };

  const handleRemoveImages = async () => {
    if (selectedImages.length === 0 || !group) return;

    Alert.alert(
      "Remove Images",
      `Are you sure you want to remove ${selectedImages.length} selected images from this group?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await GroupStorage.removeImagesFromGroup(
                group.id,
                selectedImages
              );
              setSelectedImages([]);
              await loadGroup();
            } catch (error) {
              console.error("Error removing images:", error);
              Alert.alert("Error", "Failed to remove images from group");
            }
          },
        },
      ]
    );
  };

  const toggleImageSelection = (uri: string) => {
    setSelectedImages((prev) =>
      prev.includes(uri) ? prev.filter((item) => item !== uri) : [...prev, uri]
    );
  };

  const toggleGalleryImageSelection = (uri: string) => {
    setSelectedImages((prev) =>
      prev.includes(uri) ? prev.filter((item) => item !== uri) : [...prev, uri]
    );
  };

  const handleAddImages = async () => {
    if (selectedImages.length === 0 || !group) {
      setAddModalVisible(false);
      return;
    }

    try {
      await GroupStorage.addImagesToGroup(group.id, selectedImages);
      setSelectedImages([]);
      setAddModalVisible(false);
      await loadGroup();
    } catch (error) {
      console.error("Error adding images:", error);
      Alert.alert("Error", "Failed to add images to group");
    }
  };

  const renderImageItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={[
        styles.imageContainer,
        selectedImages.includes(item) && styles.selectedImageContainer,
      ]}
      onPress={() => toggleImageSelection(item)}
      activeOpacity={0.7}
    >
      <Image source={{ uri: item }} style={styles.image} />
      {selectedImages.includes(item) && (
        <View style={styles.selectedOverlay}>
          <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
        </View>
      )}
    </TouchableOpacity>
  );

  const renderGalleryImageItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={[
        styles.imageContainer,
        selectedImages.includes(item) && styles.selectedImageContainer,
      ]}
      onPress={() => toggleGalleryImageSelection(item)}
      activeOpacity={0.7}
    >
      <Image source={{ uri: item }} style={styles.image} />
      {selectedImages.includes(item) && (
        <View style={styles.selectedOverlay}>
          <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading || !group) {
    return (
      <LinearGradient colors={GRADIENTS.cyber} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading group...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={GRADIENTS.cyber} style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: COLORS.card, borderBottomColor: COLORS.border },
        ]}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.title, { color: COLORS.foreground }]}>
              {group.name}
            </Text>
            <Text style={styles.imageCount}>
              {images.length} {images.length === 1 ? "image" : "images"}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {selectedImages.length > 0 ? (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleRemoveImages}
            >
              <Ionicons
                name="trash-outline"
                size={24}
                color={COLORS.secondary}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => {
                setSelectedImages([]);
                loadAllImages();
                setAddModalVisible(true);
              }}
            >
              <Ionicons
                name="add-circle-outline"
                size={24}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Image Grid */}
      {images.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={60} color={COLORS.secondary} />
          <Text style={[styles.emptyText, { color: COLORS.foreground }]}>
            No images in this group
          </Text>
          <TouchableOpacity
            style={[
              styles.addImagesButton,
              { backgroundColor: COLORS.primary },
            ]}
            onPress={() => {
              loadAllImages();
              setAddModalVisible(true);
            }}
          >
            <Text
              style={[
                styles.addImagesButtonText,
                { color: COLORS.primaryForeground },
              ]}
            >
              Add Images
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={images}
          renderItem={renderImageItem}
          keyExtractor={(item) => item}
          numColumns={3}
          contentContainerStyle={styles.imageGrid}
        />
      )}

      {/* Add Images Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={addModalVisible}
        onRequestClose={() => {
          setSelectedImages([]);
          setAddModalVisible(false);
        }}
      >
        <LinearGradient colors={GRADIENTS.cyber} style={styles.container}>
          <View style={[styles.modalHeader, { backgroundColor: COLORS.card }]}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setSelectedImages([]);
                setAddModalVisible(false);
              }}
            >
              <Ionicons name="close" size={24} color={COLORS.secondary} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: COLORS.foreground }]}>
              Add Images to Group
            </Text>
            <TouchableOpacity
              style={[
                styles.modalAddButton,
                { opacity: selectedImages.length > 0 ? 1 : 0.5 },
              ]}
              onPress={handleAddImages}
              disabled={selectedImages.length === 0}
            >
              <Text style={{ color: COLORS.primary, fontFamily: FONT.bold }}>
                Add
              </Text>
            </TouchableOpacity>
          </View>

          {loadingGallery ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading images...</Text>
            </View>
          ) : allImages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="images-outline"
                size={60}
                color={COLORS.secondary}
              />
              <Text style={[styles.emptyText, { color: COLORS.foreground }]}>
                No additional images available
              </Text>
            </View>
          ) : (
            <FlatList
              data={allImages}
              renderItem={renderGalleryImageItem}
              keyExtractor={(item) => item}
              numColumns={3}
              contentContainerStyle={styles.imageGrid}
            />
          )}
        </LinearGradient>
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: 15,
  },
  title: {
    fontSize: 20,
    fontFamily: FONT.bold,
  },
  imageCount: {
    fontSize: 14,
    color: COLORS.secondary,
    fontFamily: FONT.regular,
  },
  headerActions: {
    flexDirection: "row",
  },
  headerButton: {
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
  addImagesButton: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  addImagesButtonText: {
    fontSize: 16,
    fontFamily: FONT.bold,
  },
  imageGrid: {
    padding: 10,
  },
  imageContainer: {
    margin: 5,
    width: IMAGE_WIDTH,
    height: IMAGE_WIDTH,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: COLORS.muted,
  },
  selectedImageContainer: {
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  selectedOverlay: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 2,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: FONT.bold,
  },
  modalAddButton: {
    padding: 8,
  },
});

export default GroupDetailScreen;
