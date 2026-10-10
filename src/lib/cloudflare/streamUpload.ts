import * as tus from "tus-js-client";
import { supabase } from "@/integrations/supabase/client";

export interface CloudflareUploadSession {
  videoId: string;
  cloudflareUid: string;
  uploadUrl: string;
}

export async function createCloudflareUpload(input: {
  file: File;
  duration: number;
  title: string;
  description: string;
  privacy: "public" | "followers" | "private";
}): Promise<CloudflareUploadSession> {
  const { data, error } = await supabase.functions.invoke("create-cloudflare-upload", {
    body: {
      file_size: input.file.size,
      content_type: input.file.type,
      duration: input.duration,
      title: input.title,
      description: input.description,
      privacy: input.privacy,
    },
  });
  if (error) throw error;
  if (typeof data?.video_id !== "string" || typeof data?.cloudflare_uid !== "string" || typeof data?.upload_url !== "string") {
    throw new Error("Cloudflare n’a pas fourni les informations d’upload attendues.");
  }
  return { videoId: data.video_id, cloudflareUid: data.cloudflare_uid, uploadUrl: data.upload_url };
}

export function uploadVideoWithTus(
  file: File,
  uploadUrl: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      uploadUrl,
      chunkSize: 50 * 1024 * 1024,
      retryDelays: [0, 3000, 5000, 10000],
      onProgress: (uploaded, total) => onProgress(Math.round((uploaded / total) * 100)),
      onError: reject,
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}

export async function refreshCloudflareVideoStatus(videoId: string): Promise<"processing" | "ready" | "error"> {
  const { data, error } = await supabase.functions.invoke("complete-cloudflare-upload", {
    body: { video_id: videoId },
  });
  if (error) throw error;
  if (!['processing', 'ready', 'error'].includes(data?.status)) {
    throw new Error("Statut Cloudflare Stream invalide.");
  }
  return data.status;
}

export async function removeFailedCloudflareUpload(videoId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("delete-cloudflare-upload", {
    body: { video_id: videoId },
  });
  if (error) throw error;
}
