<script lang="ts">
	import '$lib/ui.css';
	import type { ActionData } from './$types';

	import { tasksWritable } from '$lib/stores';
	import { onMount } from 'svelte';
	import type ytdl from 'ytdl-core';

	export let form: ActionData;
	let newVideoDialog: HTMLDialogElement;
	let linkInput: HTMLInputElement;
	let quality: 'max' | 'mid' | 'min';
	let format: 'mp4' | 'mkv';

	// Error occured at form validation
	$: if (form?.err) {
		if (linkInput) {
			linkInput.value = form.formData.link || '';
			if (form.err === 'Please specify a link !') {
				linkInput.ariaInvalid = 'true';
			}
		}
		quality = form.formData.quality || '';
		format = form.formData.format || '';
		newVideoDialog?.showModal();
	}

	async function refreshVideos() {
		$tasksWritable = (await (await fetch('/api/tasks')).json()) as {
			link: string;
			quality: 'max' | 'mid' | 'min';
			format: 'mp4' | 'mkv';
			progress: { audio: number; video: number; merge: unknown };
			videoDetails: ytdl.videoInfo['videoDetails'];
		}[];
	}

	async function cancelTask(id: number) {
		await fetch(`/api/cancel/${id}`);
	}

	onMount(() => {
		refreshVideos();
		setInterval(refreshVideos, 500);
	});
</script>

<dialog bind:this={newVideoDialog}>
	<article>
		<header>
			<button
				on:click={() => {
					newVideoDialog.close();
				}}
				aria-label="Close"
				rel="prev"
			></button>
			<p>
				<strong>New download</strong>
			</p>
		</header>

		<form method="POST">
			<!-- <form action="/download"> -->
			{#if form?.err}
				<p style="color: red;">{form.err}</p>
			{/if}
			<fieldset>
				<label>
					Lien de la vidéo
					<input
						name="link"
						placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
						bind:this={linkInput}
						on:change={(e) => {
							//@ts-expect-error cannot be null as e = input[name=link]...
							e.target.ariaInvalid = '';
						}}
					/>
				</label>

				<label>
					Qualité
					<select name="quality" bind:value={quality}>
						<option value="max">Maximum</option>
						<option value="mid">Modérée</option>
						<option value="min">Minimum</option>
					</select>
				</label>

				<label>
					Format
					<select name="format" bind:value={format}>
						<option value="mp4">MP4</option>
						<option value="mkv">MKV</option>
					</select>
				</label>
			</fieldset>

			<input type="submit" value="Start download" />
		</form>
	</article>
</dialog>

<main class="container">
	<button
		on:click={() => {
			newVideoDialog.showModal();
		}}>New download</button
	>

	{#each $tasksWritable as video, index}
		{#if video.videoDetails !== null}
			<article class="task" role="group">
				<div class="taskThumbnail">
					<img src={video.videoDetails.thumbnails[0].url} alt="" />
				</div>

				<div class="taskInfos">
					<h3><a href={video.videoDetails.video_url}>{video.videoDetails.title}</a></h3>

					<!-- <progress class="progress" value="50" max="100"></progress> -->
					<div class="progress-container" data-tooltip="Audio Download Progress">
						<div style="width:{video.progress.audio}%" class="audio progress"></div>
					</div>
					<div class="progress-container" data-tooltip="Video Download Progress">
						<div style="width:{video.progress.video}%" class="video progress"></div>
					</div>
				</div>

				<div class="cancel-button-container">
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<!-- <svg
						on:click={() => {
							cancelTask(index);
						}}
						xmlns="http://www.w3.org/2000/svg"
						class="cancel-button icon icon-tabler icon-tabler-trash-x"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						fill="none"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M4 7h16" /><path
							d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"
						/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /><path
							d="M10 12l4 4m0 -4l-4 4"
						/></svg
					> -->
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<svg
						on:click={() => {
							cancelTask(index);
						}}
						xmlns="http://www.w3.org/2000/svg"
						class="cancel-button icon icon-tabler icon-tabler-x"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						fill="none"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M18 6l-12 12" /><path
							d="M6 6l12 12"
						/></svg
					>
				</div>
			</article>
		{/if}
	{/each}

	<!-- <article class="task" role="group">
		<div class="taskThumbnail">
			<img
				src="https://i.ytimg.com/vi/vFW_TxKLyrE/hqdefault.jpg?sqp=-oaymwEbCKgBEF5IVfKriqkDDggBFQAAiEIYAXABwAEG&rs=AOn4CLDv9CTHhkAwFXpDqm50C9QoMcZQyA"
				alt=""
			/>
		</div>

		<div class="taskInfos">
			<h3><a href="https://www.youtube.com/watch?v=vFW_TxKLyrE">Expo in 100 seconds</a></h3>

			<div class="progress-container" data-tooltip="Audio Download Progress">
				<div class="audio progress"></div>
			</div>
			<div class="progress-container" data-tooltip="Video Download Progress">
				<div class="video progress"></div>
			</div>
		</div>

		<div class="cancel-button-container">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="cancel-button icon icon-tabler icon-tabler-trash-x"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				fill="none"
				stroke-linecap="round"
				stroke-linejoin="round"
				><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M4 7h16" /><path
					d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"
				/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /><path
					d="M10 12l4 4m0 -4l-4 4"
				/></svg
			>
		</div>
	</article> -->
</main>
