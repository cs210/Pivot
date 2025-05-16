// Reexport the native module. On web, it will be resolved to ExpoObjectCaptureModule.web.ts
// and on native platforms to ExpoObjectCaptureModule.ts
export { default } from './ExpoObjectCaptureModule';
export { default as ExpoObjectCaptureView } from './ExpoObjectCaptureView';
export * from  './ExpoObjectCapture.types';
