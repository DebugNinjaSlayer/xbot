import axios from "axios";
import { EUploadMimeType, SendTweetV2Params, TwitterApi } from "twitter-api-v2";

import { loadEsm } from "load-esm";

const client = new TwitterApi({
  appKey: process.env.TWITTER_APP_KEY as string,
  appSecret: process.env.TWITTER_APP_SECRET as string,
  accessToken: process.env.TWITTER_ACCESS_TOKEN as string,
  accessSecret: process.env.TWITTER_ACCESS_SECRET as string,
}).readWrite;

export async function tweetText(text: string) {
  await tweet({
    text: text,
  });
}

export async function getAuthUrl(client: TwitterApi, callbackUrl?: string) {
  const authLink = await client.generateAuthLink(
    callbackUrl ?? process.env.CALLBACK_URL ?? "http://localhost:3000/callback"
  );
  return authLink;
}

export async function tweetImages(imageUrls: URL[], tweetText: string) {
  await uploadImagesAndTweet(imageUrls, tweetText);
}

async function tweet(payload: SendTweetV2Params) {
  return await client.v2.tweet(payload);
}

async function uploadImagesAndTweet(imageUrls: URL[], tweetText: string) {
  try {
    console.log(`Fetching image from: ${imageUrls}`);

    const mediaIds = [];

    for (const imageUrl of imageUrls) {
      const mediaId = await uploadMedia(imageUrl);
      mediaIds.push(mediaId);
    }

    const newTweet = await tweet({
      media: { media_ids: convertToStringArray(mediaIds) },
      text: tweetText,
    });
    console.log("Tweet posted successfully (V1):", newTweet.data.id);

    return newTweet;
  } catch (error: any) {
    console.error("Error in uploadImageAndTweet:");
    if (axios.isAxiosError(error)) {
      console.error("Axios Error:", error.message);
      if (error.response) {
        console.error("Status:", error.response.status);
      }
    } else if (error.error === true && error.errors) {
      console.error("Twitter API V2 Error:", error.errors);
    } else {
      console.error(error);
    }
    throw error;
  }
}

async function uploadMedia(imageUrl: URL) {
  const response = await axios.get(imageUrl.href, {
    responseType: "arraybuffer",
  });

  const imageBuffer = Buffer.from(response.data);
  let mimeType = "";
  const { fileTypeFromBuffer } = await loadEsm<typeof import("file-type")>(
    "file-type"
  );
  const typeInfo = await fileTypeFromBuffer(imageBuffer);

  if (typeInfo) {
    mimeType = typeInfo.mime;
    console.log(`Detected MIME type: ${mimeType}`);
  } else {
    console.error("Could not detect a supported image type from buffer.");
    const extension = imageUrl.href.split(".").pop()?.toLowerCase();
    if (extension === "jpg" || extension === "jpeg") mimeType = "image/jpeg";
    else if (extension === "png") mimeType = "image/png";
    else if (extension === "gif") mimeType = "image/gif";
    else if (extension === "webp") mimeType = "image/webp";
    else {
      throw new Error(
        `Cannot determine supported MIME type for URL: ${imageUrl}`
      );
    }
    console.log(`Inferred MIME type from extension: ${mimeType}`);
  }

  if (!mimeType) {
    throw new Error(
      `Failed to determine a supported MIME type. Last attempt: ${mimeType}`
    );
  }

  console.log(`Uploading media with MIME type: ${mimeType}`);

  const mediaId = await client.v1.uploadMedia(imageBuffer, {
    mimeType: mimeType as EUploadMimeType,
    type: "jpg", // TODO: make this dynamic
  });
  console.log(`Media uploaded successfully (V1). Media ID: ${mediaId}`);
  return mediaId;
}

function convertToStringArray(
  arr: string[]
):
  | [string]
  | [string, string]
  | [string, string, string]
  | [string, string, string, string] {
  if (arr.length > 4) {
    throw new Error("Array length exceeds 4.");
  }

  switch (arr.length) {
    case 1:
      return arr as [string];
    case 2:
      return arr as [string, string];
    case 3:
      return arr as [string, string, string];
    case 4:
      return arr as [string, string, string, string];
    default:
      throw new Error("Array length exceeds 4.");
  }
}
