import { _decorator, Component, Node, Label } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('PianoKey')
export class PianoKey extends Component {
    @property(Node)
    public pressedVisual: Node | null = null; // Тот самый серый спрайт

    @property(Label)
    public keyLabel: Label | null = null; // Подпись ноты (C, D, E...)

    @property(Boolean)
    public isBlack: boolean = false;

    private _noteName: string = "";

    init(name: string) {
        this._noteName = name;
        if (this.keyLabel) this.keyLabel.string = name;
    }

    setPressed(isPressed: boolean) {
        if (this.pressedVisual) {
            this.pressedVisual.active = isPressed;
        }
    }

    get noteName() { return this._noteName; }
}