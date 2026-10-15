import type { VideoDecision, VideoMeta } from "./types";

export interface EvaluateVideoRequest {
  type: "EVALUATE_VIDEO";
  video: VideoMeta;
}

export interface EvaluateVideoResponse {
  decision: VideoDecision;
}

export type BackgroundRequest = EvaluateVideoRequest;

export function evaluateVideo(video: VideoMeta): Promise<EvaluateVideoResponse> {
  return chrome.runtime.sendMessage<BackgroundRequest, EvaluateVideoResponse>({
    type: "EVALUATE_VIDEO",
    video,
  });
}
