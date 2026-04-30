
import { _decorator, Component, Node, director} from 'cc';
const { ccclass, property } = _decorator;

@ccclass('MainMenu')
export class MainMenu extends Component {
       
    /**
    * Метод для перехода в сцену пианино
    */
   public startGamePiano() {        
        // 1. Сначала подгружаем сцену в фоне
        director.preloadScene("GameScenePiano", () => {
            // 2. Когда всё готово — переключаемся
            director.loadScene("GameScenePiano");
        });
   }

   /**
    * Метод для перехода в сцену гитары
    */
   public startGameGuitar() {
        director.preloadScene("GameSceneGuitar", () => {
            director.loadScene("GameSceneGuitar");
        });
   }
   
      /**
    * Метод для перехода в главное меню
    */
   public BackMenu() {
        director.preloadScene("MenuScene", () => {
            director.loadScene("MenuScene");
        });
   }
}
