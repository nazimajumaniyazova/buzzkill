import {Game} from './Game'
export class UI {
  game: Game;
  fontSize: number;
  fontFamily: string;
  color: string;
  constructor(game: Game){
    this.game = game;
    this.fontSize = 25;
    this.fontFamily = 'Bangers';
    this.color = 'black';
  }
  draw(context: CanvasRenderingContext2D) {
    context.save()
    context.fillStyle = this.color;
    context.font = this.fontSize + 'px ' + this.fontFamily;
    context.fillText('Score: ' + this.game.score, 20, 40);

    //timer
    const formetedTime = (this.game.gameTime * 0.001).toFixed(1)
    context.fillText('Timer: ' + formetedTime, 20, 100)
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