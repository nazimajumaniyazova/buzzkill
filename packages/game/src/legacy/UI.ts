import {Game} from './Game'
import { dayTime} from '../type/settingModal'
export class UI {
  game: Game;
  fontSize: number;
  fontFamily: string;
  color: string;
  livesImage: CanvasImageSource
  constructor(game: Game){
    this.game = game;
    this.fontSize = 25;
    this.fontFamily = 'Bangers';
    if(dayTime === 'dayTime'){
      this.color = 'black';
    }else{
      this.color = 'white'
    }
    this.livesImage = document.querySelector('.heart') as CanvasImageSource;
  }
  draw(context: CanvasRenderingContext2D) {
    context.save()
    context.fillStyle = this.color;
    context.font = this.fontSize + 'px ' + this.fontFamily;
    context.fillText('Score: ' + this.game.score, 20, 40);
    //lives
    for(let i = 0; i< this.game.lives; i++) {
      context.drawImage(this.livesImage, 25 * i + 125 ,20, 25, 25)
    }
    //timer
    const formetedTime = (this.game.gameTime * 0.001).toFixed(1)
    context.fillText('Timer: ' + formetedTime, 20, 80)
    // game over
    if(this.game.gameOver) {
      context.textAlign = 'center';
      let message1
      let message2
      if(this.game.score > this.game.winningScore){
        message1 = 'You Win!'
        message2 = 'Well done!'
      }else {
        message1 = 'You lose!'
        message2 = 'Try again next time'
      }
      context.font = '50px ' + this.fontFamily;
      context.fillText(message1, this.game.width * 0.5, this.game.height * 0.5 - 30);
      context.font = '25px ' + this.fontFamily;
      context.fillText(message2, this.game.width * 0.5, this.game.height * 0.5 + 30);
    }
    context.restore()
  }
}