import { _decorator, Component, Node, Label, Slider, ProgressBar, Prefab,
    instantiate, Vec3, Color, Sprite, tween, UIOpacity, resources, JsonAsset } from 'cc';
import { PitchDetector } from 'pitchy';
import { LessonManager, LessonType } from './LessonManager';
import { KeyboardManager } from './KeyboardManager';

const { ccclass, property } = _decorator;

type LessonText = {
    helper: string;
    initial: string;
    lower?: string;
    higher?: string;
    wrongOctave?: string;
    octaveProgress?: string;
    requiredHits?: number;
    progress?: string;
    play?: string;
    successSequence?: string[];
    completeSequence?: string[];
};

type LessonTextsData = {
    lessons: Record<string, LessonText>;
};

const DEFAULT_LESSON_TEXTS: LessonTextsData = {
    lessons: {
        "0": {
            helper: "Урок 1: Найди 4-ю октаву. Просто играй ноты, а я скажу, если ты в правильной октаве!",
            initial: "Найди 4-ю октаву на своем инструменте",
            lower: "Бери правее! (Выше)",
            higher: "Бери левее! (Ниже)",
            octaveProgress: "Сделано нажатий: {current} / {required}",
            requiredHits: 3,
            successSequence: [
                "Верно! Это 4-я октава. Ты большой молодец!",
                "Все пианино разделено на октавы.",
                "В каждой октаве есть 12 нот: 7 белых и 5 черных.", 
                " Научиться находить нужную октаву - первый шаг к уверенной игре!",
                "Перейдем к следующему уроку!"
            ]
        },
        "1": {
            helper: "Урок 2: Знакомство с клавишами. Теперь попробуй сыграть все белые ноты в 4-й октаве. Я буду запоминать!",
            initial: "Нажимай разные клавиши (нужно 7)",
            wrongOctave: "Почти! Но нам нужны ноты именно в 4-й октаве.",
            progress: "Это нота {noteNameRUS}! Собрано: {progress}",
            completeSequence: [
                "Отлично! Ты изучил все базовые ноты.",
                "Переходим к мелодии!"
            ]
        },
        "2": {
            helper: "Урок 3: Сыграем последовательность!",
            initial: "Приготовься играть мелодию!",
            play: "Сыграй: {targetNote}",
            completeSequence: [
                "Браво! Ты прошел обучение!"
            ]
        },
        "3": {
            helper: "Обучение завершено",
            initial: "Ты прошел обучение!"
        }
    }
};

@ccclass('PitchDetectorComponent')
export class PitchDetectorComponent extends Component {

    @property(Prefab)
    public notePrefab: Prefab | null = null;

    @property(Node)
    public spawnParent: Node | null = null;

    @property(Label)
    public noteLabel: Label | null = null;

    @property(Label)
    public instructionLabel: Label | null = null;
    @property(Label)
    public instructionLabelHelper: Label | null = null;

    @property(Node)
    public nextLessonTextButton: Node | null = null;

    @property(Node)
    public nextLessonButton: Node | null = null;

    @property(KeyboardManager)
    public keyboard: KeyboardManager | null = null;

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

    @property(Node)
    public menuNode: Node | null = null;

    private audioContext: AudioContext;
    private analyserNode: AnalyserNode;
    private pitchDetector: PitchDetector<Float32Array>;
    private inputBuffer: Float32Array;

    // порог громкости для игнорирования шума
    public volumeThreshold = 0.03;
    private readonly MAX_VOLUME_THRESHOLD = 1.0;

    private lessonTexts: LessonTextsData = DEFAULT_LESSON_TEXTS;
    private activeTextSequence: string[] | null = null;
    private activeTextSequenceIndex = 0;
    private activeTextSequenceLesson: LessonType | null = null;
    private activeTextSequenceComplete: (() => void) | null = null;
    private lastUnlockedLessonTextSequence: string[] | null = null;
    private lessonTextReadComplete = false;
    private octaveLessonHits = 0;


    start() {
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        
        // Подтягиваем данные из меню
        const instrument = (window as any).selectedInstrument || "piano"; 
        this.setupInstrumentRanges(instrument);

        if (this.sensitivitySlider) {
            this.sensitivitySlider.progress = this.volumeThreshold / this.MAX_VOLUME_THRESHOLD;
        }
        this.updateLessonButtons(false, false);
        LessonManager.getInstance().events.on(
            LessonManager.LESSON_CHANGED_EVENT,
            this.refreshLessonView,
            this
        );

        this.loadLessonTexts();
        
        this.refreshLessonView();
    }

    onDestroy() {
        LessonManager.getInstance().events.off(
            LessonManager.LESSON_CHANGED_EVENT,
            this.refreshLessonView,
            this
        );
    }

    private loadLessonTexts() {
        resources.load('lessons', JsonAsset, (error, asset) => {
            if (error) {
                console.warn('Could not load lessons.json, using default lesson texts.', error);
                return;
            }

            this.lessonTexts = asset.json as LessonTextsData;
            this.refreshLessonView();
        });
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
        const NOTE_NAMES_RUS = ["До", "До#", "Ре", "Ре#", "Ми", "Фа", "Фа#", "Соль", "Соль#", "Ля", "Ля#", "Си"];

        // Рассчитываем MIDI номер ноты
        // 12 * log2(f / 440) + 69
        const midiNote = 12 * (Math.log(frequency / 440) / Math.log(2)) + 69;
    
        const roundedMidi = Math.round(midiNote);
        const centsOff = Math.floor((midiNote - roundedMidi) * 100); // Насколько игрок фальшивит
        
        const noteIndex = roundedMidi % 12;
        const octave = Math.floor(roundedMidi / 12) - 1;
        // console.log("noteIndex", noteIndex, "octave", octave);
        // console.log(`Определена нота: ${NOTE_NAMES[noteIndex]}, Октава: ${octave}, Промах: ${centsOff} центов (${frequency} Гц)`);
        let note = {noteName: NOTE_NAMES[noteIndex], noteNameRUS: NOTE_NAMES_RUS[noteIndex], octave: octave, centsOff: centsOff}
        return note;
    }


    update(deltaTime: number) {
        if (!this.analyserNode || !this.pitchDetector || !this.inputBuffer || !this.audioContext) return;

        this.analyserNode.getFloatTimeDomainData(this.inputBuffer);

        if (!this.checkThreshold()) {
            this.lastNote = "";
            if (this.keyboard) this.keyboard.highlightNote("");
            return;
        }
        
        const [pitch, clarity] = this.pitchDetector.findPitch(this.inputBuffer, this.audioContext.sampleRate);
        
        if (clarity > 0.8 && pitch > 24) {
            let noteInfo: any = this.getNoteByFrequency(pitch);

            if (noteInfo && this.noteLabel) {
                const displayText = `${noteInfo.noteName}${noteInfo.octave}`;
                if (displayText !== this.lastNote) {
                    this.noteLabel.string = displayText;
                    this.lastNote = displayText;
                    // подсветка клавиши на экране
                    if (noteInfo && noteInfo.octave === 4) {
                        console.log("this.keyboard", this.keyboard);
                        // Подсвечиваем клавишу на экране
                        if (this.keyboard) {
                            console.log("Подсветка клавиши:", noteInfo);
                            this.keyboard.highlightNote(noteInfo.noteName);
                        }
                    } else {
                        // Если октава не та — гасим все клавиши
                        if (this.keyboard) this.keyboard.highlightNote("");
                    }
                    // логика уроков...
                    this.checkLessonProgress(noteInfo);
                    this.spawnNoteSprite(noteInfo); // Вызываем наш новый метод
                }
            }
        }
    }

    private syncVolumeThresholdFromSlider() {
        if (this.sensitivitySlider) {
            this.volumeThreshold = this.sensitivitySlider.progress * this.MAX_VOLUME_THRESHOLD;
        }
    }

    checkThreshold(): boolean {
        this.syncVolumeThresholdFromSlider();

        // Вычисляем среднюю громкость (RMS)
        let sumSquares = 0;
        for (let i = 0; i < this.inputBuffer.length; i++) {
            sumSquares += this.inputBuffer[i] * this.inputBuffer[i];
        }
        const rms = Math.sqrt(sumSquares / this.inputBuffer.length);

        if (this.volumeMeter) {
            // rms обычно очень маленькое число (0.01 - 0.2). 
            // Умножаем на коэффициент (например, 5), чтобы полоска была более динамичной
            this.volumeMeter.progress = Math.min(rms / this.MAX_VOLUME_THRESHOLD, 1);
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
        this.volumeThreshold = slider.progress * this.MAX_VOLUME_THRESHOLD;
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
                //console.log("Удаление ноты:", noteInfo.noteName);
                newNote.destroy(); // Обязательное удаление из сцены и памяти
            })
            .start();
    }

    // Внутри твоего основного компонента в методе update или после детекции ноты:

    private getLessonText(type: LessonType): LessonText {
        return this.lessonTexts.lessons[type.toString()] || DEFAULT_LESSON_TEXTS.lessons[type.toString()];
    }

    private formatLessonText(text: string, values: Record<string, string>): string {
        return text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
    }

    private setInstructionText(helper: string, instruction: string) {
        if (this.instructionLabelHelper) {
            this.instructionLabelHelper.string = helper;
        }

        if (this.instructionLabel) {
            this.instructionLabel.string = instruction;
        }
    }

    private updateLessonButtons(showTextButton: boolean, showLessonButton: boolean) {
        if (this.nextLessonTextButton) {
            this.nextLessonTextButton.active = showTextButton;
        }

        if (this.nextLessonButton) {
            this.nextLessonButton.active = showLessonButton;
        }
    }

    private finishTextSequence() {
        const onComplete = this.activeTextSequenceComplete;
        this.activeTextSequence = null;
        this.activeTextSequenceIndex = 0;
        this.activeTextSequenceLesson = null;
        this.activeTextSequenceComplete = null;
        this.lessonTextReadComplete = true;
        this.updateLessonButtons(false, true);
        onComplete?.();
    }

    private startTextSequence(sequence: string[] | undefined, lesson: LessonType, onComplete?: () => void) {
        if (!sequence || sequence.length === 0) {
            onComplete?.();
            return;
        }

        this.activeTextSequence = sequence;
        this.lastUnlockedLessonTextSequence = sequence;
        this.activeTextSequenceIndex = 0;
        this.activeTextSequenceLesson = lesson;
        this.activeTextSequenceComplete = onComplete || null;
        this.lessonTextReadComplete = false;

        if (this.instructionLabel) {
            this.instructionLabel.string = sequence[0];
        }

        if (sequence.length === 1) {
            this.finishTextSequence();
            return;
        }

        this.updateLessonButtons(true, false);
    }

    private advanceTextSequence(): boolean {
        const manager = LessonManager.getInstance();

        if (!this.activeTextSequence || this.activeTextSequenceLesson !== manager.currentLesson) {
            return false;
        }

        this.activeTextSequenceIndex++;

        if (this.activeTextSequenceIndex < this.activeTextSequence.length) {
            if (this.instructionLabel) {
                this.instructionLabel.string = this.activeTextSequence[this.activeTextSequenceIndex];
            }

            if (this.activeTextSequenceIndex >= this.activeTextSequence.length - 1) {
                this.finishTextSequence();
            }

            return true;
        }

        this.finishTextSequence();

        return true;
    }

    public onNextLessonTextButton() {
        this.advanceTextSequence();
    }

    public onNextLessonButton() {
        if (!this.lessonTextReadComplete) {
            return;
        }

        this.updateLessonButtons(false, false);
        LessonManager.getInstance().nextLesson();
    }

    public onSelectLessonButton(event: any, customEventData: string) {
        const lessonIndex = Number.parseInt(customEventData, 10);

        if (Number.isNaN(lessonIndex)) {
            console.warn('Invalid lesson index:', customEventData);
            return;
        }

        LessonManager.getInstance().setLesson(lessonIndex as LessonType);
    }

    checkLessonProgress(noteInfo: any) {
        if (this.activeTextSequence || this.lessonTextReadComplete) {
            return;
        }

        const manager = LessonManager.getInstance();
        const fullNote = `${noteInfo.noteName}${noteInfo.octave}`;

        switch (manager.currentLesson) {
            case LessonType.FIND_OCTAVE:
                this.handleOctaveLesson(noteInfo.octave);
                break;

            case LessonType.IDENTIFY_NOTES:
                this.handleIdentifyLesson(noteInfo);
                break;

            case LessonType.PLAY_MELODY:
                this.handleMelodyLesson(fullNote);
                break;
        }
    }

    // 1 Урок: Навигация по октавам
    handleOctaveLesson(octave: number) {
        const lesson = LessonType.FIND_OCTAVE;
        const texts = this.getLessonText(lesson);

        if (this.instructionLabelHelper) {
            this.instructionLabelHelper.string = texts.helper;
        }

        if (octave < 4) {
            if (this.instructionLabel) {
                this.instructionLabel.string = texts.lower || '';
            }
            return;
        }

        if (octave > 4) {
            if (this.instructionLabel) {
                this.instructionLabel.string = texts.higher || '';
            }
            return;
        }

        const requiredHits = texts.requiredHits || 3;
        this.octaveLessonHits = Math.min(this.octaveLessonHits + 1, requiredHits);

        if (this.octaveLessonHits < requiredHits) {
            if (this.instructionLabel) {
                this.instructionLabel.string = this.formatLessonText(texts.octaveProgress || '', {
                    current: this.octaveLessonHits.toString(),
                    required: requiredHits.toString()
                });
            }
            return;
        }

        this.startTextSequence(texts.successSequence, lesson);
        return;
    }

    // 2 Урок: Знакомство с клавишами
    handleIdentifyLesson(noteInfo: any) {
        const lesson = LessonType.IDENTIFY_NOTES;
        const texts = this.getLessonText(lesson);
        const manager = LessonManager.getInstance();

        if (this.instructionLabelHelper) {
            this.instructionLabelHelper.string = texts.helper;
        }

        if (noteInfo.octave !== 4) {
            if (this.instructionLabel) {
                this.instructionLabel.string = texts.wrongOctave || '';
            }
            return;
        }

        const isFinished = manager.registerNote(noteInfo.noteName);

        if (isFinished) {
            this.startTextSequence(texts.completeSequence, lesson);
            return;
        }

        if (this.instructionLabel) {
            this.instructionLabel.string = this.formatLessonText(texts.progress || '', {
                noteNameRUS: noteInfo.noteNameRUS,
                progress: manager.getProgressString()
            });
        }
        return;
    }

    // 3 Урок: Простая партия
    handleMelodyLesson(noteName: string) {
        const lesson = LessonType.PLAY_MELODY;
        const texts = this.getLessonText(lesson);
        const manager = LessonManager.getInstance();
        const targetNote = manager.melodyToPlay[manager.currentNoteIndex];

        if (this.instructionLabelHelper) {
            this.instructionLabelHelper.string = texts.helper;
        }

        if (this.instructionLabel) {
            this.instructionLabel.string = this.formatLessonText(texts.play || '', {
                targetNote
            });
        }

        if (noteName === targetNote) {
            manager.currentNoteIndex++;
            if (manager.currentNoteIndex >= manager.melodyToPlay.length) {
                this.startTextSequence(texts.completeSequence, lesson);
                return;
            }
        }
        return;
    }

    refreshLessonView() {
        console.log("refreshLessonView called");
        const manager = LessonManager.getInstance();
        const texts = this.getLessonText(manager.currentLesson);

        this.activeTextSequence = null;
        this.activeTextSequenceIndex = 0;
        this.activeTextSequenceLesson = null;
        this.activeTextSequenceComplete = null;
        this.lastUnlockedLessonTextSequence = null;
        this.lessonTextReadComplete = false;
        this.octaveLessonHits = 0;
        this.updateLessonButtons(false, false);
        this.setInstructionText(texts.helper, texts.initial);
    }
}
