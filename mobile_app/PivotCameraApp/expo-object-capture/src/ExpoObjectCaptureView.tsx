import { requireNativeView } from 'expo';
import * as React from 'react';

import { ExpoObjectCaptureViewProps } from './ExpoObjectCapture.types';

const NativeView: React.ComponentType<ExpoObjectCaptureViewProps> =
  requireNativeView('ExpoObjectCapture');

export default function ExpoObjectCaptureView(props: ExpoObjectCaptureViewProps) {
  return <NativeView {...props} />;
}
