import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import * as FileSystem from "expo-file-system";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, GRADIENTS, STYLES } from "../theme";

const SCREEN_WIDTH = Dimensions.get("window").width;
const IMAGE_WIDTH = (SCREEN_WIDTH - 50) / 3;

interface ImageItem {
  uri: string;
  filename: string;
  selected: boolean;
}

const GalleryScreen: React.FC = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedImages, setSelectedImages] = useState<ImageItem[]>([]);

  // Load images when the screen is focused
  useEffect(() => {
    if (isFocused) {
      loadImages();
    }
  }, [isFocused]);

  // Load captured images from file system
  const loadImages = async () => {
    try {
      setLoading(true);

      const dirPath = `${FileSystem.documentDirectory}room_scanner/`;
      const dirInfo = await FileSystem.getInfoAsync(dirPath);

      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
        setImages([]);
        setLoading(false);
        return;
      }

      const files = await FileSystem.readDirectoryAsync(dirPath);
      const imageFiles = files.filter(
        (file) =>
          file.endsWith(".jpg") ||
          file.endsWith(".jpeg") ||
          file.endsWith(".png")
      );

      const imageData = imageFiles.map((file) => ({
        uri: `${dirPath}${file}`,
        filename: file,
        selected: false,
      }));

      // Sort by filename (which includes timestamp)
      imageData.sort((a, b) => b.filename.localeCompare(a.filename));

      setImages(imageData);
    } catch (error) {
      console.error("Error loading images:", error);
      Alert.alert("Error", "Failed to load captured images.");
    } finally {
      setLoading(false);
    }
  };

  // Toggle image selection
  const toggleSelection = (index: number) => {
    const updatedImages = [...images];
    updatedImages[index].selected = !updatedImages[index].selected;
    setImages(updatedImages);

    if (updatedImages[index].selected) {
      setSelectedImages([...selectedImages, updatedImages[index]]);
    } else {
      setSelectedImages(
        selectedImages.filter((img) => img.uri !== updatedImages[index].uri)
      );
    }
  };

  // Delete selected images
  const deleteSelectedImages = async () => {
    if (selectedImages.length === 0) return;

    Alert.alert(
      "Delete Images",
      `Are you sure you want to delete ${selectedImages.length} selected images?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              for (const image of selectedImages) {
                await FileSystem.deleteAsync(image.uri);
              }

              // Refresh gallery
              setSelectedImages([]);
              await loadImages();
            } catch (error) {
              console.error("Error deleting images:", error);
              Alert.alert("Error", "Failed to delete selected images.");
            }
          },
        },
      ]
    );
  };

  // Render an image item
  const renderImageItem = ({
    item,
    index,
  }: {
    item: ImageItem;
    index: number;
  }) => (
    <TouchableOpacity
      style={styles.imageContainer}
      onPress={() => toggleSelection(index)}
      activeOpacity={0.8}
    >
      <Image source={{ uri: item.uri }} style={styles.image} />
      {item.selected && (
        <View style={styles.selectedOverlay}>
          <Ionicons name="checkmark-circle" size={24} color="#4a90e2" />
        </View>
      )}
    </TouchableOpacity>
  );

  // Export images for stitching
  const exportImages = async () => {
    Alert.alert(
      "Export Images",
      "Images are saved to your device's gallery and can be used for 3D reconstruction.",
      [{ text: "OK" }]
    );
  };

  return (
    <LinearGradient colors={GRADIENTS.cyber} style={styles.container}>
      {/* Header with selection count and actions */}
      <View
        style={[
          styles.header,
          { backgroundColor: COLORS.card, borderBottomColor: COLORS.border },
        ]}
      >
        <Text style={[styles.title, { color: COLORS.foreground }]}>
          {selectedImages.length === 0
            ? `${images.length} Captured Images`
            : `${selectedImages.length} Selected`}
        </Text>

        {selectedImages.length > 0 && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={deleteSelectedImages}
          >
            <Ionicons name="trash-outline" size={24} color={COLORS.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a90e2" />
          <Text style={styles.loadingText}>Loading images...</Text>
        </View>
      ) : images.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={60} color={COLORS.secondary} />
          <Text style={[styles.emptyText, { color: COLORS.foreground }]}>
            No images captured yet
          </Text>
          <TouchableOpacity
            style={[styles.captureButton, { backgroundColor: COLORS.primary }]}
            onPress={() => navigation.navigate("Camera" as never)}
          >
            <Text
              style={[
                styles.captureButtonText,
                { color: COLORS.primaryForeground },
              ]}
            >
              Start Capturing
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={images}
            renderItem={renderImageItem}
            keyExtractor={(item) => item.uri}
            numColumns={3}
            contentContainerStyle={styles.imageGrid}
          />

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.exportButton, { backgroundColor: COLORS.primary }]}
              onPress={exportImages}
            >
              <Text
                style={[
                  styles.exportButtonText,
                  { color: COLORS.primaryForeground },
                ]}
              >
                Export for 3D Reconstruction
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    backgroundColor: "white",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  deleteButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 15,
    color: "#666",
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: "#888",
    marginTop: 20,
    marginBottom: 30,
  },
  captureButton: {
    backgroundColor: "#4a90e2",
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  captureButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
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
    backgroundColor: "#ddd",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  selectedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  footer: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    backgroundColor: "white",
  },
  exportButton: {
    backgroundColor: "#4CAF50",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  exportButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default GalleryScreen;
