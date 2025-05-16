declare module "expo-ar" {
  export const AR: {
    createSessionAsync: (options: {
      configuration: {
        sceneReconstruction: "meshWithClassification";
        frameSemantics: string[];
      };
    }) => Promise<{
      startAsync: (options: {
        resetTracking: boolean;
        removeExistingAnchors: boolean;
      }) => Promise<void>;
      stopAsync: () => Promise<void>;
      addEventListener: (event: string, callback: (event: any) => void) => void;
    }>;
  };
}
