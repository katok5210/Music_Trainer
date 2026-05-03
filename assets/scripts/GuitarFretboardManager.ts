import { _decorator, Color, Component, Prefab, instantiate, Sprite, Vec3, UITransform } from 'cc';
import { PianoKey } from './PianoKey';
const { ccclass, property } = _decorator;

type GuitarStringNote = {
    noteName: string;
    octave: number;
};

type GuitarFretNote = GuitarStringNote & {
    fullNote: string;
};

@ccclass('GuitarFretboardManager')
export class GuitarFretboardManager extends Component {
    @property({ type: Prefab, tooltip: 'Префаб деревянного основания грифа' })
    public woodBackgroundPrefab: Prefab | null = null;

    @property({ type: Prefab, tooltip: 'Префаб струны (тонкая линия или спрайт)' })
    public stringLinePrefab: Prefab | null = null;

    @property({ type: Prefab, tooltip: 'Префаб активной зоны лада (куда нажимать)' })
    public fretPrefab: Prefab | null = null;

    @property({ type: Prefab, tooltip: 'Prefab for vertical fret bars. If empty, stringLinePrefab is used.' })
    public fretLinePrefab: Prefab | null = null;

    @property({ type: Prefab, tooltip: 'Prefab for decorative fret markers. If empty, fretPrefab is used.' })
    public fretMarkerPrefab: Prefab | null = null;

    private keys: Map<string, PianoKey> = new Map();
    private keyNotes: Map<string, GuitarFretNote> = new Map();
    private pressedKeyIds: Set<string> = new Set();
    private targetKeyIds: Set<string> = new Set();
    private readonly pressedColor = new Color(255, 236, 90);
    private readonly targetColor = new Color(70, 170, 255);
    
    private readonly stringOpenNotes: GuitarStringNote[] = [
        { noteName: "E", octave: 4 },
        { noteName: "B", octave: 3 },
        { noteName: "G", octave: 3 },
        { noteName: "D", octave: 3 },
        { noteName: "A", octave: 2 },
        { noteName: "E", octave: 2 }
    ];
    private readonly noteSequence = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

    @property public fretWidth = 120;   // Расстояние между ладами
    @property public stringSpacing = 50; // Расстояние между струнами
    @property public totalFrets = 12;     // Количество ладов

    @property public fretLineWidth = 6;
    @property public markerSize = 22;

    start() {
        this.buildFretboard();
    }

    buildFretboard() {
        this.node.removeAllChildren();
        this.keys.clear();
        this.keyNotes.clear();
        this.pressedKeyIds.clear();
        this.targetKeyIds.clear();

        if (!this.fretPrefab) {
            console.warn('GuitarFretboardManager: fretPrefab is not assigned.');
            return;
        }

        // 1. Создаем деревянное основание
        if (this.woodBackgroundPrefab) {
            const bg = instantiate(this.woodBackgroundPrefab);
            bg.parent = this.node;
            // Растягиваем фон под размер грифа (примерно)
            const bgTransform = bg.getComponent(UITransform);
            if (bgTransform) {
                bgTransform.setContentSize(
                    (this.totalFrets + 1) * this.fretWidth, 
                    this.stringOpenNotes.length * this.stringSpacing + 40
                );
            }
            bg.setPosition(new Vec3(this.totalFrets * this.fretWidth / 2, -((this.stringOpenNotes.length - 1) / 2) * this.stringSpacing, 0));
            bg.setSiblingIndex(0); // Всегда на заднем плане
        }

        // 2. Создаем струны и лады
        this.buildFretLines();
        this.buildFretMarkers();

        for (let s = 0; s < this.stringOpenNotes.length; s++) {
            
            // Визуализация самой струны (линия)
            if (this.stringLinePrefab) {
                const stringLine = instantiate(this.stringLinePrefab);
                stringLine.parent = this.node;
                stringLine.setPosition(new Vec3(this.totalFrets * this.fretWidth / 2, -s * this.stringSpacing, 0));
                
                const lineTransform = stringLine.getComponent(UITransform);
                if (lineTransform) {
                    lineTransform.setContentSize((this.totalFrets + 1) * this.fretWidth, 5); // Тонкая длинная линия
                }
                stringLine.setSiblingIndex(1); // Поверх дерева, но под нотами
            }

            const openNote = this.stringOpenNotes[s];

            // Создаем интерактивные точки нот на ладах
            for (let f = 0; f <= this.totalFrets; f++) {
                const note = this.getFretNote(openNote, f);
                const keyId = `S${s}_F${f}_${note.fullNote}`;

                let fretNode = instantiate(this.fretPrefab);
                fretNode.parent = this.node;
                fretNode.setPosition(new Vec3(this.getFretCenterX(f), -s * this.stringSpacing, 0));
                fretNode.setSiblingIndex(2); // Поверх всего

                let keyComp = fretNode.getComponent(PianoKey);
                if (!keyComp) {
                    keyComp = fretNode.addComponent(PianoKey);
                }

                if (!keyComp.pressedVisual) {
                    keyComp.pressedVisual = fretNode;
                }

                keyComp.init(note.noteName);
                keyComp.setPressed(false);
                this.keys.set(keyId, keyComp);
                this.keyNotes.set(keyId, note);
            }
        }
    }

    public highlightNote(noteName: string, octave?: number) {
        this.pressedKeyIds.clear();

        this.keys.forEach((keyComp, keyId) => {
            const note = this.keyNotes.get(keyId);
            const isPressed = !!note && !!noteName && (
                octave === undefined
                    ? note.noteName === noteName
                    : note.noteName === noteName && note.octave === octave
            );

            if (isPressed) {
                this.pressedKeyIds.add(keyId);
            }
        });

        this.applyVisualStates();
    }

    public showTargetNote(noteName: string, octave?: number) {
        this.targetKeyIds.clear();

        this.keyNotes.forEach((note, keyId) => {
            const isTarget = !!noteName && (
                octave === undefined
                    ? note.noteName === noteName
                    : note.noteName === noteName && note.octave === octave
            );

            if (isTarget && !keyId.includes("_F0_")) {
                this.targetKeyIds.add(keyId);
            }
        });

        this.applyVisualStates();
    }

    public showTargetFullNote(fullNote: string) {
        const parsed = this.parseFullNote(fullNote);

        if (!parsed) {
            this.clearTargetHighlights();
            return;
        }

        this.showTargetNote(parsed.noteName, parsed.octave);
    }

    public clearTargetHighlights() {
        this.targetKeyIds.clear();
        this.applyVisualStates();
    }

    private applyVisualStates() {
        this.keys.forEach((keyComp, keyId) => {
            const isPressed = this.pressedKeyIds.has(keyId);
            const isTarget = this.targetKeyIds.has(keyId);
            const visual = keyComp.pressedVisual || keyComp.node;
            const sprite = visual.getComponent(Sprite);

            if (sprite) {
                sprite.color = isPressed ? this.pressedColor : this.targetColor;
            }

            visual.active = isPressed || isTarget;
        });
    }

    private parseFullNote(fullNote: string): GuitarStringNote | null {
        const match = /^([A-G]#?)(-?\d+)$/.exec(fullNote);

        if (!match) return null;

        return {
            noteName: match[1],
            octave: Number.parseInt(match[2], 10)
        };
    }

    private buildFretLines() {
        const linePrefab = this.fretLinePrefab || this.stringLinePrefab;
        if (!linePrefab) return;

        const height = this.getFretboardHeight();
        const centerY = this.getFretboardCenterY();

        for (let fret = 0; fret <= this.totalFrets; fret++) {
            const line = instantiate(linePrefab);
            line.parent = this.node;
            line.setPosition(new Vec3(fret * this.fretWidth, centerY, 0));
            line.setSiblingIndex(1);

            const transform = line.getComponent(UITransform);
            if (transform) {
                const width = fret === 0 ? this.fretLineWidth * 2 : this.fretLineWidth;
                transform.setContentSize(width, height);
            }
        }
    }

    private buildFretMarkers() {
        const markerPrefab = this.fretMarkerPrefab || this.fretPrefab;
        if (!markerPrefab) return;

        const markerFrets = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];

        markerFrets.forEach((fret) => {
            if (fret > this.totalFrets) return;

            const isDoubleMarker = fret % 12 === 0;
            const markerYPositions = isDoubleMarker
                ? [this.getFretboardCenterY() + this.stringSpacing, this.getFretboardCenterY() - this.stringSpacing]
                : [this.getFretboardCenterY()];

            markerYPositions.forEach((y) => {
                const marker = instantiate(markerPrefab);
                marker.parent = this.node;
                marker.active = true;
                marker.setPosition(new Vec3(this.getFretCenterX(fret), y, 0));
                marker.setSiblingIndex(1);

                const transform = marker.getComponent(UITransform);
                if (transform) {
                    transform.setContentSize(this.markerSize, this.markerSize);
                }
            });
        });
    }

    private getFretCenterX(fret: number): number {
        return fret === 0
            ? -this.fretWidth / 2
            : (fret - 0.5) * this.fretWidth;
    }

    private getFretboardCenterY(): number {
        return -((this.stringOpenNotes.length - 1) / 2) * this.stringSpacing;
    }

    private getFretboardHeight(): number {
        return (this.stringOpenNotes.length - 1) * this.stringSpacing + 40;
    }

    private getFretNote(openNote: GuitarStringNote, fret: number): GuitarFretNote {
        const midi = this.getMidiNumber(openNote) + fret;
        const noteName = this.noteSequence[midi % this.noteSequence.length];
        const octave = Math.floor(midi / this.noteSequence.length) - 1;

        return {
            noteName,
            octave,
            fullNote: `${noteName}${octave}`
        };
    }

    private getMidiNumber(note: GuitarStringNote): number {
        const noteIndex = this.noteSequence.indexOf(note.noteName);

        return (note.octave + 1) * this.noteSequence.length + noteIndex;
    }
}
