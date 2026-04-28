
import { _decorator, Component, Node, director, TransitionGui } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('MainMenu')
export class MainMenu extends Component {

    // Тип выбранного инструмента для передачи в игровую сцену
    public static selectedInstrument: string = 'piano';

    onSelectPiano() {
        MainMenu.selectedInstrument = 'piano';
        this.startGame();
    }

    onSelectGuitar() {
        MainMenu.selectedInstrument = 'guitar';
        this.startGame();
    }

    private startGame() {
        // Плавный переход на сцену с игрой
        director.loadScene("GameScene");
    }

    onOpenSettings() {
        // Логика открытия окна настроек
        console.log("Настройки: проверка доступа к микрофону");
    }
}
