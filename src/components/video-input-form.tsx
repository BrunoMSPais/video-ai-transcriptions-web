import { ChangeEvent, FormEvent, useMemo, useRef, useState } from 'react'
import { FileVideo, Upload } from 'lucide-react'
import { fetchFile } from '@ffmpeg/util'
import { getFFmpeg } from '../lib/ffmpeg'
import { Separator } from './ui/separator'
import { Textarea } from './ui/textarea'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { api } from '../lib/axios'

type TStatus =
	| 'waiting'
	| 'converting'
	| 'uploading'
	| 'transcribing'
	| 'success'

interface VideoInputFormProps {
	onVideoUploaded: (videoId: string) => void
}

const statusMessages = {
	waiting: 'Carregar vídeo',
	converting: 'Convertendo',
	uploading: 'Enviando',
	transcribing: 'Transcrevendo',
	success: 'Sucesso!',
}

export function VideoInputForm({ onVideoUploaded }: VideoInputFormProps) {
	const [videoFile, setVideoFile] = useState<File | null>(null)
	const [status, setStatus] = useState<TStatus>('waiting')

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

		setStatus('converting')

		// convert video to audio using client
		const audioFile = await convertVideoToAudio(videoFile)

		const data = new FormData()
		data.append('file', audioFile)

		setStatus('uploading')

		// upload audio file to server
		const response = await api.post('/videos', data)

		const videoId = response.data.video.id

		setStatus('transcribing')

		// get transcription from server
		await api.post(`/videos/${videoId}/transcription`, { prompt })

		setStatus('success')

		onVideoUploaded(videoId) // lifting state up
	}

	const previewURL = useMemo(() => {
		if (!videoFile) return null

		return URL.createObjectURL(videoFile)
	}, [videoFile])

	return (
		<form
			onSubmit={handleUploadVideo}
			className='space-y-6'
		>
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
					disabled={status !== 'waiting'}
					id='transcription_prompt'
					className='h-20 resize-none leading-relaxed'
					placeholder='Inclua palavras-chave mencionadas no vídeo separadas por vírgula (,)'
				/>
			</div>
			<Button
				data-success={status === 'success'}
				disabled={status !== 'waiting'}
				type='submit'
				className='w-full data-[success=true]:bg-emerald-400'
			>
				{statusMessages[status]}
				<Upload className='w-4 h-4 ml-2' />
			</Button>
		</form>
	)
}
