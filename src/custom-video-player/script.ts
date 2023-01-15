import './style.css'

let isPlaying = false
let progress = 0
let timestamp = '00:00'

const videoRef = document.querySelector<HTMLVideoElement>('#video')
videoRef?.addEventListener('click', togglerPlayer)
videoRef?.addEventListener('ended', stopPlayer)
// videoRef?.addEventListener('timeupdate', seek)

const playBtn = document.querySelector('#play')
playBtn?.addEventListener('click', togglerPlayer)

const stopBtn = document.querySelector('#stop')
stopBtn?.addEventListener('click', stopPlayer)

const progressRef = document.querySelector<HTMLInputElement>('#progress')
progressRef?.addEventListener('change', seek)

const timestampRef = document.querySelector<HTMLHeadElement>('#timestamp')

setInterval(() => {
  if (!progressRef || !timestampRef) return
  progressRef.value = progress + ''
  timestampRef.innerText = timestamp
}, 1000)

videoRef?.addEventListener('timeupdate', () => {
  progress = (videoRef.currentTime / videoRef.duration) * 100
  let minutes = Math.floor(videoRef.currentTime / 60).toString()
  minutes = (minutes.length < 2 ? '0' : '') + minutes

  let seconds = Math.floor(videoRef.currentTime % 60).toString()
  seconds = (seconds.length < 2 ? '0' : '') + seconds
  timestamp = `${minutes}:${seconds}`
  if (videoRef.ended) {
    isPlaying = false
  }
})

function togglerPlayer() {
  isPlaying = !isPlaying
  if (isPlaying) {
    videoRef?.play()
    playBtn?.classList.remove('fa-play')
  } else {
    videoRef?.pause()
    playBtn?.classList.add('fa-play')
  }
}
function stopPlayer() {
  isPlaying = false
  progress = 0
}
function seek(e: any) {
  if (!videoRef) return
  const val = e.target?.value
  videoRef.currentTime = (val * videoRef.duration) / 100
}
