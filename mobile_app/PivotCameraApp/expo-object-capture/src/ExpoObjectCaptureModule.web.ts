import { registerWebModule, NativeModule } from 'expo';

import { ExpoObjectCaptureModuleEvents } from './ExpoObjectCapture.types';

class ExpoObjectCaptureModule extends NativeModule<ExpoObjectCaptureModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(ExpoObjectCaptureModule, 'ExpoObjectCaptureModule');
