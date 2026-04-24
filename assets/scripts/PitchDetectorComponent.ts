import { _decorator, Component, Node } from 'cc';
import { PitchDetector } from 'pitchy';

const { ccclass, property } = _decorator;

@ccclass('PitchDetectorComponent')
export class PitchDetectorComponent extends Component {

    private audioContext: AudioContext;
    private analyserNode: AnalyserNode;
    private pitchDetector: PitchDetector<Float32Array>;
    private inputBuffer: Float32Array;

    // порог громкости для игнорирования шума
    static readonly VOLUME_THRESHOLD = 0.03;


    start() {
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    }

    onTouchStart(){
        this.initAudio()
    }

    async initAudio() {
        if (!this.audioContext) {
            this.audioContext = new AudioContext();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = this.audioContext.createMediaStreamSource(stream);
            this.analyserNode = this.audioContext.createAnalyser();
            console.log("this.analyserNode", this.analyserNode);
            this.analyserNode.fftSize = 2048;
            source.connect(this.analyserNode);
            this.pitchDetector = PitchDetector.forFloat32Array(this.analyserNode.fftSize);
            this.inputBuffer = new Float32Array(this.pitchDetector.inputLength);

            console.log("Audio initialized");
        }
    }

    getNoteByFrequency(frequency: number): string {
        const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

        // Рассчитываем MIDI номер ноты
        // 12 * log2(f / 440) + 69
        const midiNote = 12 * (Math.log(frequency / 440) / Math.log(2)) + 69;
    
        const roundedMidi = Math.round(midiNote);
        const centsOff = Math.floor((midiNote - roundedMidi) * 100); // Насколько игрок фальшивит
        
        const noteIndex = roundedMidi % 12;
        const octave = Math.floor(roundedMidi / 12) - 1;
        // console.log("noteIndex", noteIndex, "octave", octave);
        console.log(`Определена нота: ${NOTE_NAMES[noteIndex]}, Октава: ${octave}, Промах: ${centsOff} центов (${frequency} Гц)`);
        return ""
    }


    update(deltaTime: number) {
        if (!this.analyserNode || !this.pitchDetector || !this.inputBuffer || !this.audioContext) return;

        // Копируем данные из анализатора в буфер
        this.analyserNode.getFloatTimeDomainData(this.inputBuffer);

        if (!this.checkThreshold()) {
            return;
        }
        
        // Определяем частоту и уверенность (clarity)
        const [pitch, clarity] = this.pitchDetector.findPitch(this.inputBuffer, this.audioContext.sampleRate);
        //console.log("this.pitchDetector", this.pitchDetector)
        //console.log(`Уверенность: ${clarity.toFixed(2)}`);
        //console.log(`Частота: ${pitch.toFixed(2)}`);
        if (clarity > 0.8 && pitch > 24) { // Если сигнал достаточно чистый
            // console.log(`Частота: ${pitch.toFixed(2)} Гц`);
            this.getNoteByFrequency(pitch);
            // Тут вызывай свою логику обработки ноты
        }

    }

    checkThreshold(): boolean {
        // Вычисляем среднюю громкость (RMS)
        let sumSquares = 0;
        for (let i = 0; i < this.inputBuffer.length; i++) {
            sumSquares += this.inputBuffer[i] * this.inputBuffer[i];
        }
        const rms = Math.sqrt(sumSquares / this.inputBuffer.length);
    
        if (rms < PitchDetectorComponent.VOLUME_THRESHOLD) {
            // Сигнал слишком тихий, это просто шум
            return false;
        }
        return true;
    }
}


