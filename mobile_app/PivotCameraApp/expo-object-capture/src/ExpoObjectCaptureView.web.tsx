import * as React from 'react';

import { ExpoObjectCaptureViewProps } from './ExpoObjectCapture.types';

export default function ExpoObjectCaptureView(props: ExpoObjectCaptureViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
