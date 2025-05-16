import { NativeModule, requireNativeModule } from 'expo';

import { ExpoObjectCaptureModuleEvents } from './ExpoObjectCapture.types';

declare class ExpoObjectCaptureModule extends NativeModule<ExpoObjectCaptureModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ExpoObjectCaptureModule>('ExpoObjectCapture');
