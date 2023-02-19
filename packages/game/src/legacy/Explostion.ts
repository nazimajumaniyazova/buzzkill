import {Game} from './Game';

export class Explotion {
  game: Game;
  frameX: number;
  spriteHeight: number;
  timer: number;
  interval: number
  markForDeletion: boolean;
  maxFrame: number
  constructor(game: Game){
    this.game = game;
    this.frameX = 0;
    this.spriteHeight = 200;
    this.timer = 0;
    this.interval = 1000 / 30;
    this.markForDeletion = false;
    this.maxFrame = 8
  }
  update(deltaTime: number) {
    if(this.timer > this.interval){
      this.frameX++
      this.timer = 0
    }else {
      this.timer += deltaTime
    }
    if(this.frameX > this.maxFrame) {
      this.markForDeletion = true;
    }
  }
  draw(context: CanvasRenderingContext2D, image: CanvasImageSource, x: number, y: number, width: number) {
    context.strokeRect(x, y, 200, 200)
    context.drawImage(
      image, 
      this.frameX * width,
      0,
      width,
      this.spriteHeight,
      x, 
      y,
      width,
      this.spriteHeight)
  }
}

export class smokeExplostion extends Explotion {
  x: number;
  y: number;
  spriteWidth: number;
  image: CanvasImageSource
  constructor(game: Game,x:number,y:number){
    super(game)
    this.image = new Image(200,200)
    this.image.src = './catalog-img/smokeExplosion.png'
    this.spriteWidth = 200;
    this.x = x - this.spriteWidth * 0.5;
    this.y = y  - this.spriteHeight * 0.5;
  }
  update(deltaTime: number): void {
    super.update(deltaTime)
    this.x -= this.game.speed
  }
  draw(context: CanvasRenderingContext2D) {
    super.draw(context, this.image, this.x, this.y, this.spriteWidth)
  }
}
export class fireExplostion extends Explotion {
  x: number;
  y: number;
  spriteWidth: number;
  image: CanvasImageSource
  constructor(game: Game,x:number,y:number){
    super(game)
    this.image = new Image(200,200)
    this.image.src = './catalog-img/fireExplosion.png'
    this.spriteWidth = 200;
    this.x = x - this.spriteWidth * 0.5;
    this.y = y  - this.spriteHeight * 0.5;
  }
  update(deltaTime: number): void {
    super.update(deltaTime)
    this.x -= this.game.speed
  }
  draw(context: CanvasRenderingContext2D) {
    super.draw(context, this.image, this.x, this.y, this.spriteWidth)
  }
}