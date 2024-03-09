import type { RequestHandler } from './$types';
import { tasksWritable } from '$lib/server/stores';

export const GET: RequestHandler = ({ params }) => {
    const id = parseInt(params.id)

    tasksWritable.update((tasks) => { 
        tasks[id].cancel()
        return [ ...(tasks.splice(id+1, 1)) ]
    })

    return new Response("")
};