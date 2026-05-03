
import { _decorator, Component, Node, director} from 'cc';
const { ccclass, property } = _decorator;

@ccclass('MainMenu')
export class MainMenu extends Component {
       
    /**
    * Метод для перехода в сцену пианино
    */
   public startGamePiano() {        
        (window as any).selectedInstrument = "piano";
        // 1. Сначала подгружаем сцену в фоне
        director.preloadScene("GameScenePiano", () => {
            // 2. Когда всё готово — переключаемся
            this.loadSceneAndFocus("GameScenePiano");
        });
   }

   /**
    * Метод для перехода в сцену гитары
    */
   public startGameGuitar() {
        (window as any).selectedInstrument = "guitar";
        director.preloadScene("GameSceneGuitar", () => {
            this.loadSceneAndFocus("GameSceneGuitar");
        });
   }
   
      /**
    * Метод для перехода в главное меню
    */
   public BackMenu() {
        director.preloadScene("MenuScene", () => {
            this.loadSceneAndFocus("MenuScene");
        });
   }

   private loadSceneAndFocus(sceneName: string) {
        director.loadScene(sceneName, () => {
            setTimeout(() => {
                const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;

                if (!canvas) return;

                canvas.tabIndex = canvas.tabIndex >= 0 ? canvas.tabIndex : 0;
                canvas.focus();
            }, 0);
        });
   }
}
