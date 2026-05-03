import { EventTarget, sys } from 'cc';

export enum LessonType {
    FIND_OCTAVE = 0,
    IDENTIFY_NOTES = 1,
    PLAY_MELODY = 2,
    COMPLETED = 3
}

export class LessonManager {
    private static _instance: LessonManager;
    public static readonly LESSON_CHANGED_EVENT = 'lesson-changed';

    public readonly events = new EventTarget();
    public currentLesson: LessonType = LessonType.FIND_OCTAVE;
    private currentInstrument = 'piano';

    private masteredNotes: Set<string> = new Set();
    private readonly REQUIRED_NOTES_COUNT = 7;
    
    // Для 3-го урока (мелодия: До, Ре, Ми)
    public melodyToPlay = ["C4", "D4", "E4"];
    public currentNoteIndex = 0;

    private constructor() {
        this.loadProgress();
    }

    public static getInstance(): LessonManager {
        if (!this._instance) this._instance = new LessonManager();
        return this._instance;
    }

    // Сохранение прогресса
    public setInstrument(instrument: string) {
        const nextInstrument = instrument === 'guitar' ? 'guitar' : 'piano';

        if (this.currentInstrument === nextInstrument) return;

        this.currentInstrument = nextInstrument;
        this.masteredNotes.clear();
        this.currentNoteIndex = 0;
        this.loadProgress();
        this.events.emit(LessonManager.LESSON_CHANGED_EVENT, this.currentLesson);
    }

    public saveProgress() {
        sys.localStorage.setItem(this.getProgressKey(), this.currentLesson.toString());
    }

    private loadProgress() {
        let saved = sys.localStorage.getItem(this.getProgressKey());

        if (saved === null && this.currentInstrument === 'piano') {
            saved = sys.localStorage.getItem('currentLesson');
        }

        // saved = 0;
        if (saved !== null) {
            this.currentLesson = parseInt(saved);
        } else {
            this.currentLesson = LessonType.FIND_OCTAVE;
        }
    }

    private getProgressKey(): string {
        return `currentLesson:${this.currentInstrument}`;
    }

    public nextLesson() {
        if (this.currentLesson < LessonType.COMPLETED) {
            this.currentLesson++;
            this.masteredNotes.clear();
            this.currentNoteIndex = 0;
            this.saveProgress();
            this.events.emit(LessonManager.LESSON_CHANGED_EVENT, this.currentLesson);
        }
    }

    public reset() {
        this.currentLesson = LessonType.FIND_OCTAVE;
        this.saveProgress();
        this.events.emit(LessonManager.LESSON_CHANGED_EVENT, this.currentLesson);
    }

    // Выбор урока
    public setLesson(type: LessonType) {
    this.currentLesson = type;
    this.masteredNotes.clear(); // Сбрасываем прогресс 2-го урока при переключении
    this.currentNoteIndex = 0;   // Сбрасываем прогресс 3-го урока
    this.saveProgress();
    this.events.emit(LessonManager.LESSON_CHANGED_EVENT, this.currentLesson);
}

    // Метод для регистрации нажатой ноты
    public registerNote(noteName: string): boolean {
        this.masteredNotes.add(noteName);
        
        // Если собрали 7 нот, возвращаем true (урок окончен)
        if (this.masteredNotes.size >= this.REQUIRED_NOTES_COUNT) {
            this.masteredNotes.clear(); // Очищаем для будущего
            return true;
        }
        return false;
    }

    // Чтобы знать, сколько еще осталось
    public getProgressString(): string {
        return `${this.masteredNotes.size} / ${this.REQUIRED_NOTES_COUNT}`;
    }
}
