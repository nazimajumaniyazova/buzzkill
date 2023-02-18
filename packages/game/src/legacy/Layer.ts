import {Game} from './Game'
export class Layer {
  game: Game
  image: CanvasImageSource;
  width: number;
  height: number;
  x: number;
  y: number;
  speedModifier: number;
  constructor(game: Game,image: CanvasImageSource ,speedModifier: number){
    this.game = game;
    this.image = image;
    this.speedModifier = speedModifier;
    this.width = this.game.width;
    this.height = this.game.height;
    this.x = 0;
    this.y  = 0;
  }
  update() {
    // if(this.x <= - this.width) this.x = 0
    // this.x -= this.game.speed * this.speedModifier
  }
  draw(context: CanvasRenderingContext2D) {
    context.drawImage(this.image, this.x, this.y, this.width, this.height)
  //  context.drawImage(this.image, this.x + this.width, this.y, this.width, this.height)
  }
}