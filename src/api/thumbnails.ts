import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";	

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

	const base64Encoded = Buffer.from(fileData).toString("base64");
	const base64DataURL = `data:${mediaType};base64,${base64Encoded}`;

	video.thumbnailURL = base64DataURL;

	// 11. update the record in the database by using the updateVideo function available in db/videos.
	updateVideo(cfg.db, video);

	return respondWithJSON(200, null);
}
