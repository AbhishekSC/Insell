import axios from "axios";
import axiosInstance from "./axios";

// Direct-to-Cloudinary upload for property media — the file bytes go
// straight from the browser to Cloudinary using a short-lived signature
// from our own server, instead of being proxied through our Node process.
// Keeps large video uploads (up to 50MB) off our server's memory/bandwidth.
//
// Cloudinary requires the exact params used to compute the signature to be
// resent with the actual upload, so `folder`/`allowed_formats`/`timestamp`
// here must match what the server signed — see
// getPropertyMediaUploadSignature in propertyPost.controller.js.
const MAX_PROPERTY_MEDIA_BYTES = 50 * 1024 * 1024;

async function uploadOneFileToCloudinary(file, signatureData, onFileProgress) {
  const { signature, timestamp, apiKey, cloudName, folder, allowed_formats } = signatureData;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", apiKey);
  formData.append("timestamp", timestamp);
  formData.append("signature", signature);
  formData.append("folder", folder);
  formData.append("allowed_formats", allowed_formats);

  const response = await axios.post(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, formData, {
    onUploadProgress: (event) => {
      if (!event.total) return;
      onFileProgress?.(Math.round((event.loaded / event.total) * 100));
    },
  });

  return response.data.secure_url;
}

// Uploads files sequentially (not in parallel) so a single aggregate
// progress percentage stays meaningful and so ordering is trivially
// preserved by await order rather than relying on concurrent requests
// resolving in the right sequence.
export async function uploadPropertyMedia(files, onProgress) {
  const oversized = files.find((file) => file.size > MAX_PROPERTY_MEDIA_BYTES);
  if (oversized) {
    throw new Error(`${oversized.name} is larger than 50MB`);
  }

  const { data } = await axiosInstance.get("/posts/upload-media/signature");
  const signatureData = data?.data;

  const urls = [];
  for (let i = 0; i < files.length; i += 1) {
    const url = await uploadOneFileToCloudinary(files[i], signatureData, (filePercent) => {
      const overallPercent = Math.round(((i + filePercent / 100) / files.length) * 100);
      onProgress?.(overallPercent);
    });
    urls.push(url);
  }

  return urls;
}
