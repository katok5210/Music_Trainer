import { _decorator, Component, Prefab, instantiate, Node, UITransform } from 'cc';
import { PianoKey } from './PianoKey';
const { ccclass, property } = _decorator;

@ccclass('KeyboardManager')
export class KeyboardManager extends Component {
    @property(Prefab) public whiteKeyPrefab: Prefab | null = null;
    @property(Prefab) public blackKeyPrefab: Prefab | null = null;

    private keys: Map<string, PianoKey> = new Map();
    
    // Полный список нот октавы
    private readonly octaveNotes = [
        { name: "C",  isBlack: false }, { name: "C#", isBlack: true  },
        { name: "D",  isBlack: false }, { name: "D#", isBlack: true  },
        { name: "E",  isBlack: false },
        { name: "F",  isBlack: false }, { name: "F#", isBlack: true  },
        { name: "G",  isBlack: false }, { name: "G#", isBlack: true  },
        { name: "A",  isBlack: false }, { name: "A#", isBlack: true  },
        { name: "B",  isBlack: false }
    ];

    private whiteKeyWidth = 80; // Ширина белой клавиши в пикселях

    start() {
        this.buildKeyboard();
    }

    buildKeyboard() {
        let whiteCount = 0;

        this.octaveNotes.forEach((noteData) => {
            const isBlack = noteData.isBlack;
            const prefab = isBlack ? this.blackKeyPrefab : this.whiteKeyPrefab;
            
            let keyNode = instantiate(prefab);
            keyNode.parent = this.node;

            let keyComp = keyNode.getComponent(PianoKey);
            keyComp.init(noteData.name);
            this.keys.set(noteData.name, keyComp);

            // Позиционирование
            if (!isBlack) {
                // Белые клавиши идут строго друг за другом
                keyNode.setPosition(whiteCount * this.whiteKeyWidth, 0, 0);
                whiteCount++;
                // Белые клавиши должны быть под черными по Z-индексу
                keyNode.setSiblingIndex(0); 
            } else {
                // Черная клавиша ставится между текущей белой и следующей
                // Сдвигаем её на половину ширины белой назад
                const xPos = (whiteCount - 1) * this.whiteKeyWidth + (this.whiteKeyWidth / 1.4);
                keyNode.setPosition(xPos, 100, 0); // Чуть выше по Y (наложение)
                // Черные клавиши должны быть отрисованы поверх белых
                keyNode.setSiblingIndex(this.node.children.length);
            }
        });
    }

    public highlightNote(noteName: string) {
        this.keys.forEach((key, name) => {
            key.setPressed(name === noteName);
        });
    }
}