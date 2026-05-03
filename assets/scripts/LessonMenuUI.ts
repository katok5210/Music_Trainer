import { _decorator, Component, Node, EventHandler } from 'cc';
import { LessonManager, LessonType } from './LessonManager';
const { ccclass, property } = _decorator;

@ccclass('LessonUI')
export class LessonUI extends Component {

    @property(Node)
    public menuPanel: Node | null = null;

    // Метод для кнопок (вызывается из инспектора)
    public selectLesson(event: any, customEventData: string) {
        const lessonIndex = parseInt(customEventData);
        LessonManager.getInstance().setLesson(lessonIndex as LessonType);
        
        // Закрываем меню после выбора
        this.toggleMenu();
        
        // Опционально: вызываем обновление текста в основном скрипте
        // (лучше всего через глобальное событие)
        console.log('Lesson changed to:', lessonIndex);
        this.node.emit('lesson-changed');
    }

    public toggleMenu() {
        if (this.menuPanel) {
            this.menuPanel.active = !this.menuPanel.active;
        }
    }
}