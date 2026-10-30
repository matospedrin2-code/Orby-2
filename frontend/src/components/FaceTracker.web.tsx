// Web preview: on-device face tracking is only available in the installed app.
export const faceTrackingAvailable = false;

export type TrackerPermission = { available: boolean; granted: boolean; canAsk: boolean; request: () => Promise<boolean> };

export function useTrackerPermission(): TrackerPermission {
  return { available: false, granted: false, canAsk: false, request: async () => false };
}

type Props = {
  active: boolean;
  granted: boolean;
  mirror: boolean;
  preview: boolean;
  onFace: (x: number, y: number, smiling: number, closeness: number) => void;
};

export function FaceTracker(_props: Props) {
  return null;
}
