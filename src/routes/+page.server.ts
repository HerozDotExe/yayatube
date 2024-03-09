import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import {tasksWritable} from '$lib/server/stores';
import Video from '$lib/Video';

export const actions = {
    default: async ({request}) => {
        const data = await request.formData();
        const link = data.get("link") as string
        const quality = data.get("quality") as "max" | "mid" | "min"
        const format = data.get("format") as "mp4" | "mkv"

        if(link === "") return fail(400, {err:"Please specify a link !", formData: {link, quality, format}});

        const video = new Video({link, quality, format})

        try {
            await video.download()
        } catch (error) {
            //@ts-expect-error can't type error to anything else that unknown...
            if(error.message === "VideoExists"){
                //@ts-expect-error can't type error to anything else that unknown...
                return fail(400, {err:`"${error.cause}" has already been downloaded. Check the output folder.`, formData: {link, quality, format}})
            } else {console.error("a",error)}
        }
        
        tasksWritable.update((tasks) => [...tasks, video])
    },
} satisfies Actions;