import { writable, type Writable } from "svelte/store";
import type ytdl from "ytdl-core";

export const tasksWritable: Writable<{link: string, quality: "max" | "mid" | "min", format: "mp4" | "mkv", progress: { audio: number, video: number, merge: unknown }, videoDetails: ytdl.videoInfo["videoDetails"]}[]> = writable([])