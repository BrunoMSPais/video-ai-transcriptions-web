import { ChangeEvent, FormEvent, useMemo, useRef, useState } from 'react'
import { FileVideo, Upload } from 'lucide-react'
import { fetchFile } from '@ffmpeg/util'
import { getFFmpeg } from '../lib/ffmpeg'
import { Separator } from './ui/separator'
import { Textarea } from './ui/textarea'
import { Button } from './ui/button'
import { Label } from './ui/label'

export function VideoInputForm() {
	const [videoFile, setVideoFile] = useState<File | null>(null)
	const promptInputRef = useRef<HTMLTextAreaElement>(null)

	function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
		const { files } = event.currentTarget

		if (!files) return

		const selectedFile = files[0]

		setVideoFile(selectedFile)
	}

	async function convertVideoToAudio(video: File) {
		const ffmpeg = await getFFmpeg()

		/* BEGIN CONVERSION */

		await ffmpeg.writeFile('input.mp4', await fetchFile(video))

		/* for debugging purposes */
		// ffmpeg.on('log', log => console.log(log))

		ffmpeg.on('progress', progress => {
			console.log(
				'Convert progress: ' + Math.round(progress.progress * 100) + '%',
			)
		})

		/* 
			instructions to convert video to audio using ffmpeg with the following parameters:
			input: input.mp4
			output: output.mp3
			bitrate: 20k
			audio codec lib: libmp3lame
			map: 0:a 
		*/
		await ffmpeg.exec([
			'-i',
			'input.mp4',
			'-map',
			'0:a',
			'-b:a',
			'20k',
			'-acodec',
			'libmp3lame',
			'output.mp3',
		])

		const data = await ffmpeg.readFile('output.mp3')

		const audioFileBlob = new Blob([data], { type: 'audio/mpeg' })
		const audioFile = new File([audioFileBlob], 'audio.mp3', {
			type: 'audio/mpeg',
		})

		/* END CONVERSION */

		return audioFile
	}

	async function handleUploadVideo(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()

		const prompt = promptInputRef.current?.value

		if (!videoFile) return

		// convert video to audio using client
		const audioFile = await convertVideoToAudio(videoFile)
	}

	const previewURL = useMemo(() => {
		if (!videoFile) return null

		return URL.createObjectURL(videoFile)
	}, [videoFile])

	return (
		<form className='space-y-6'>
			<label
				htmlFor='video'
				className='relative border flex rounded-md aspect-video items-center justify-center cursor-pointer border-dashed text-sm flex-col gap-2 text-muted-foreground hover:bg-primary/5'
			>
				{previewURL ? (
					<video
						src={previewURL}
						controls={false}
						className='pointer-events-none absolute inset-0'
					/>
				) : (
					<>
						<FileVideo className='w-4 h-4' />
						Selecione um vídeo
					</>
				)}
			</label>

			<input
				type='file'
				id='video'
				accept='video/mp4'
				className='sr-only'
				onAbort={handleFileSelected}
			/>

			<Separator />

			<div className='space-y-2'>
				<Label htmlFor='transcription_prompt'>Prompt de transcrição</Label>

				<Textarea
					ref={promptInputRef}
					id='transcription_prompt'
					className='h-20 resize-none leading-relaxed'
					placeholder='Inclua palavras-chave mencionadas no vídeo separadas por vírgula (,)'
				/>
			</div>
			<Button
				type='submit'
				className='w-full'
			>
				Carregar vídeo
				<Upload className='w-4 h-4 ml-2' />
			</Button>
		</form>
	)
}
