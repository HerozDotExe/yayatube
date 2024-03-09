import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { tasksWritable } from '$lib/server/stores';
import type Video from '$lib/Video';

let tasks: Video[];
tasksWritable.subscribe((v) => {
    tasks = v
})

export const GET: RequestHandler = () => {
    return json(tasks.map((video) => {
        // console.log(video)
        return {
            link: video.link, quality: video.quality, format: video.format, progress: video.progress, videoDetails: video.videoDetails
        }
    }))
};