import { writable, type Writable } from "svelte/store";
import Video from "../Video";

export const tasksWritable: Writable<Video[]> = writable([])