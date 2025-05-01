import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

// Define the param list for all screens
export type RootStackParamList = {
  Home: undefined;
  Camera: undefined;
  Gallery: undefined;
  Groups: undefined;
  GroupDetail: {
    groupId: string;
  };
};

// Navigation prop types
export type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Home"
>;
export type CameraScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Camera"
>;
export type GalleryScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Gallery"
>;
export type GroupsScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Groups"
>;
export type GroupDetailScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "GroupDetail"
>;

// Route prop types
export type HomeScreenRouteProp = RouteProp<RootStackParamList, "Home">;
export type CameraScreenRouteProp = RouteProp<RootStackParamList, "Camera">;
export type GalleryScreenRouteProp = RouteProp<RootStackParamList, "Gallery">;
export type GroupsScreenRouteProp = RouteProp<RootStackParamList, "Groups">;
export type GroupDetailScreenRouteProp = RouteProp<
  RootStackParamList,
  "GroupDetail"
>;

// Combined props for each screen
export interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
  route: HomeScreenRouteProp;
}

export interface CameraScreenProps {
  navigation: CameraScreenNavigationProp;
  route: CameraScreenRouteProp;
}

export interface GalleryScreenProps {
  navigation: GalleryScreenNavigationProp;
  route: GalleryScreenRouteProp;
}

export interface GroupsScreenProps {
  navigation: GroupsScreenNavigationProp;
  route: GroupsScreenRouteProp;
}

export interface GroupDetailScreenProps {
  navigation: GroupDetailScreenNavigationProp;
  route: GroupDetailScreenRouteProp;
}
