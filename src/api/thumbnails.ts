import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import { getInMemoryURL } from "./assets";

type Thumbnail = {
	data: ArrayBuffer;
	mediaType: string;
};

const videoThumbnails: Map<string, Thumbnail> = new Map();

export async function handlerGetThumbnail(cfg: ApiConfig, req: BunRequest) {
	const { videoId } = req.params as { videoId?: string };
	if (!videoId) {
		throw new BadRequestError("Invalid video ID");
	}

	const video = getVideo(cfg.db, videoId);
	if (!video) {
		throw new NotFoundError("Couldn't find video");
	}

	const thumbnail = videoThumbnails.get(videoId);
	if (!thumbnail) {
		throw new NotFoundError("Thumbnail not found");
	}

	return new Response(thumbnail.data, {
		headers: {
			"Content-Type": thumbnail.mediaType,
			"Cache-Control": "no-store",
		},
	});
}

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
	const { videoId } = req.params as { videoId?: string };
	if (!videoId) {
		throw new BadRequestError("Invalid video ID");
	}

	const token = getBearerToken(req.headers);
	const userID = validateJWT(token, cfg.jwtSecret);

	console.log("uploading thumbnail for video", videoId, "by user", userID);

	// TODO: implement the upload here
  // 1. Parse the form data
	const formData = await req.formData();
  // 2. get the image data from the form
	const file = formData.get("thumbnail");
  // 3. Check if the object is an instance of File
	if (!(file instanceof File)) {
		throw new BadRequestError("Thumbnail file missing");
	}

  // 4. Set a const MAX_UPLOAD_SIZE to 10MB
	const MAX_UPLOAD_SIZE = 10 << 20;
	if (file.size > MAX_UPLOAD_SIZE) {
		throw new BadRequestError(
			`Thumbnail file exceeds the maximum allowed size of 10MB`,
		);
	}

  // 5. Get the media type from the file's `type` property
	const mediaType = file.type;
	if (!mediaType) {
		throw new BadRequestError("Missing Content-Type for thumbnail");
	}

  // 6. Read all the image data into a ArrayBuffer using the files's arrayBuffer() method
	const fileData = await file.arrayBuffer();
	if (!fileData) {
		throw new Error("Error reading file data");
	}

  // 7. Get the video's metadata from the SQLite database, use the getVideo method available in db/videos
	const video = getVideo(cfg.db, videoId);
	if (!video) {
		throw new NotFoundError("Couldn't find video");
	}
  // if the authenticated user is not the video owner, throw a UserForbiddenError error, 
  // which is available in src/api/errors
	if (userID !== video.userID) {
		throw new UserForbiddenError("Not authorized to update this video");
	}

  // 8. Save the thumbnail to the global map(videoThumbnails)
	videoThumbnails.set(videoId, {
		data: fileData,
		mediaType: mediaType,
	});

  // 9. Generate the thumbnail URL.
  const urlPath = getInMemoryURL(cfg, videoId)
  // 10. Update the video metadata so that it uses the new thumbnail URL
  video.thumbnailURL = urlPath
  // 11. update the record in the database by using the updateVideo function available in db/videos.
  updateVideo(cfg.db, video)

	return respondWithJSON(200, null); 
}
