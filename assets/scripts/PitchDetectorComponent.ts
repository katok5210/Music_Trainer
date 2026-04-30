import { _decorator, Component, Node, Label, Slider, ProgressBar, Prefab, 
    instantiate, Vec3, Color, Sprite, tween, UIOpacity } from 'cc';
import { PitchDetector } from 'pitchy';

const { ccclass, property } = _decorator;

@ccclass('PitchDetectorComponent')
export class PitchDetectorComponent extends Component {

    @property(Prefab)
    public notePrefab: Prefab | null = null;

    @property(Node)
    public spawnParent: Node | null = null;

    @property(Label)
    public noteLabel: Label | null = null;

    // Словарь цветов для нот (система "Радуга" или До-ре-ми)
    private readonly NOTE_COLORS: Record<string, Color> = {
        "C": new Color(255, 0, 0),    // До - Красный
        "C#": new Color(255, 0, 0),
        "D": new Color(255, 127, 0),  // Ре - Оранжевый
        "D#": new Color(255, 127, 0),
        "E": new Color(255, 255, 0),  // Ми - Желтый
        "F": new Color(0, 255, 0),    // Фа - Зеленый
        "F#": new Color(0, 255, 0),
        "G": new Color(0, 0, 255),    // Соль - Синий
        "G#": new Color(0, 0, 255),
        "A": new Color(75, 0, 130),   // Ля - Индиго
        "A#": new Color(75, 0, 130),
        "B": new Color(148, 0, 211)   // Си - Фиолетовый
    };

    private lastNote: string = "";

    @property(Slider)
    public sensitivitySlider: Slider | null = null;
    @property(ProgressBar)
    public volumeMeter: ProgressBar | null = null; // Ссылка на наш UI элемент

    private audioContext: AudioContext;
    private analyserNode: AnalyserNode;
    private pitchDetector: PitchDetector<Float32Array>;
    private inputBuffer: Float32Array;

    // порог громкости для игнорирования шума
    public volumeThreshold = 0.03;


    start() {
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        
        // Подтягиваем данные из меню
        const instrument = (window as any).selectedInstrument || "piano"; 
        this.setupInstrumentRanges(instrument);

        if (this.sensitivitySlider) {
            this.sensitivitySlider.progress = this.volumeThreshold / 0.5; // Предположим, макс порог 0.5
        }
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

    getNoteByFrequency(frequency: number): object {
        const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

        // Рассчитываем MIDI номер ноты
        // 12 * log2(f / 440) + 69
        const midiNote = 12 * (Math.log(frequency / 440) / Math.log(2)) + 69;
    
        const roundedMidi = Math.round(midiNote);
        const centsOff = Math.floor((midiNote - roundedMidi) * 100); // Насколько игрок фальшивит
        
        const noteIndex = roundedMidi % 12;
        const octave = Math.floor(roundedMidi / 12) - 1;
        // console.log("noteIndex", noteIndex, "octave", octave);
        // console.log(`Определена нота: ${NOTE_NAMES[noteIndex]}, Октава: ${octave}, Промах: ${centsOff} центов (${frequency} Гц)`);
        let note = {noteName: NOTE_NAMES[noteIndex], octave: octave, centsOff: centsOff}
        return note;
    }


    update(deltaTime: number) {
        if (!this.analyserNode || !this.pitchDetector || !this.inputBuffer || !this.audioContext) return;

        this.analyserNode.getFloatTimeDomainData(this.inputBuffer);

        if (!this.checkThreshold()) return;
        
        const [pitch, clarity] = this.pitchDetector.findPitch(this.inputBuffer, this.audioContext.sampleRate);
        
        if (clarity > 0.8 && pitch > 24) {
            let noteInfo: any = this.getNoteByFrequency(pitch);

            if (noteInfo && this.noteLabel) {
                const displayText = `${noteInfo.noteName}${noteInfo.octave}`;
                
                if (displayText !== this.lastNote) {
                    this.noteLabel.string = displayText;
                    this.lastNote = displayText;
                    this.spawnNoteSprite(noteInfo); // Вызываем наш новый метод
                }
            }
        }
    }

    checkThreshold(): boolean {
        // Вычисляем среднюю громкость (RMS)
        let sumSquares = 0;
        for (let i = 0; i < this.inputBuffer.length; i++) {
            sumSquares += this.inputBuffer[i] * this.inputBuffer[i];
        }
        const rms = Math.sqrt(sumSquares / this.inputBuffer.length);

        if (this.volumeMeter) {
            // rms обычно очень маленькое число (0.01 - 0.2). 
            // Умножаем на коэффициент (например, 5), чтобы полоска была более динамичной
            this.volumeMeter.progress = rms * 5; 
        }
    
        if (rms < this.volumeThreshold) {
            // Сигнал слишком тихий, это просто шум
            return false;
        }
        return true;
    }

    // Эта функция будет вызываться каждый раз при движении ползунка
    public onSliderChange(slider: Slider) {
        // Слайдер дает значение от 0 до 1. 
        // Умножаем на 0.5, чтобы диапазон порога был от 0 до 0.5 (этого достаточно для большинства микрофонов)
        this.volumeThreshold = slider.progress * 0.3; 
        console.log("this.volumeThreshold", this.volumeThreshold)
        // if (this.thresholdLabel) {
        //     this.thresholdLabel.string = `Порог: ${this.volumeThreshold.toFixed(3)}`;
        // }
    }
    
    setupInstrumentRanges(instrument: string) {
        if (instrument === 'guitar') {
            // У гитары частоты ниже, можем подкрутить фильтры
            console.log("Режим: Гитара (E2 - 82Гц)");
        } else {
            console.log("Режим: Пианино");
        }
    }
    
    /**
     * Создает визуальный эффект для ноты
     */
spawnNoteSprite(noteInfo: any) {
    if (!this.notePrefab || !this.spawnParent) return;

    // Создаем экземпляр префаба
    const newNote = instantiate(this.notePrefab);
    newNote.parent = this.spawnParent;

    // 1. Установка цвета (через компонент Sprite)
    const sprite = newNote.getComponent(Sprite);
    if (sprite) {
        // NOTE_COLORS берем из предыдущего шага
        sprite.color = this.NOTE_COLORS[noteInfo.noteName] || Color.WHITE;
    }

    // 2. Установка начальной позиции
    // Ставим в (0,0,0) относительно родителя или со случайным смещением по X
    newNote.setPosition(new Vec3((Math.random() - 0.5) * 100, 0, 0));

    // 3. Подготовка к изменению прозрачности
    // Проверяем наличие UIOpacity, без него свойство opacity не сработает
    let uiOpacity = newNote.getComponent(UIOpacity);
    if (!uiOpacity) {
        uiOpacity = newNote.addComponent(UIOpacity);
    }

    // 4. Анимация движения ВВЕРХ
    tween(newNote)
        .by(2, { position: new Vec3(0, 400, 0) }, { easing: 'sineOut' })
        .start();

    // 5. Анимация исчезновения и УДАЛЕНИЕ
    tween(uiOpacity)
        .to(2, { opacity: 0 }, { easing: 'fade' })
        .call(() => {
            console.log("Удаление ноты:", noteInfo.noteName);
            newNote.destroy(); // Обязательное удаление из сцены и памяти
        })
        .start();
}
}


