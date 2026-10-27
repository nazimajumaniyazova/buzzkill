import {Game} from './Game';
import sound from '../sounds/smoke-bomb.wav';
export class Explotion {
  game: Game;
  frameX: number;
  height: number;
  width: number;
  timer: number;
  interval: number
  markForDeletion: boolean;
  maxFrame: number;
  sound: HTMLAudioElement;
  constructor(game: Game){
    this.game = game;
    this.frameX = 0;
    this.width = 200
    this.height = 200;
    this.timer = 0;
    this.interval = 1000 / 30;
    this.markForDeletion = false;
    this.maxFrame = 8;
    this.sound = new Audio()
    this.sound.src = sound;

  }
  update(deltaTime: number) {
    this.sound.volume = this.game.gameVolume
    if(this.frameX === 0) this.sound.play()
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
  draw(context: CanvasRenderingContext2D, image: CanvasImageSource, x: number, y: number) {
    // context.strokeRect(x, y, 200, 200)
    context.drawImage(
      image, 
      this.frameX * this.width,
      0,
      this.width,
      this.height,
      x, 
      y,
      this.width,
      this.height
    )
  }
}

export class smokeExplostion extends Explotion {
  x: number;
  y: number;
  image: CanvasImageSource
  constructor(game: Game,x:number,y:number){
    super(game)
    this.image = new Image(200,200)
    this.image.src = './catalog-img/smokeExplosion.png'
    this.x = x - this.width * 0.5;
    this.y = y  - this.height * 0.5;
  }
  update(deltaTime: number): void {
    super.update(deltaTime)
    this.x -= this.game.speed
  }
  draw(context: CanvasRenderingContext2D) {
    super.draw(context, this.image, this.x, this.y)
  }
}
export class fireExplostion extends Explotion {
  x: number;
  y: number;
  image: CanvasImageSource
  constructor(game: Game,x:number,y:number){
    super(game)
    this.image = new Image(200,200)
    this.image.src = './catalog-img/fireExplosion.png'
    this.x = x - this.width * 0.5;
    this.y = y  - this.height * 0.5;
  }
  update(deltaTime: number): void {
    super.update(deltaTime)
    this.x -= this.game.speed
  }
  draw(context: CanvasRenderingContext2D) {
    super.draw(context, this.image, this.x, this.y)
  }
}