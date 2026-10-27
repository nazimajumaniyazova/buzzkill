import {Game} from './Game'
import sound from '../sounds/bullet-sound.wav';
export class Projectile {
  game: Game;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  markedForDeletion: boolean;
  image: CanvasImageSource;
  sound: HTMLAudioElement;
  xInitialPosition: number
  constructor(game: Game, x: number,y:number) {
    this.game = game;
    this.x = x;
    this.xInitialPosition = x;
    this.y = y;
    this.width = 10;
    this.height = 3;
    this.speed = 4;
    this.markedForDeletion = false;
    this.image = new Image(this.width, this.height);
    this.image.src = './catalog-img/projectile.png'
    this.sound = new Audio()
    this.sound.src = sound;
  }
  update() {
    this.sound.volume = this.game.gameVolume
    if(this.x === this.xInitialPosition){
      this.sound.play()
    }
    this.x += this.speed;
    if(this.x > this.game.width * 0.8){  //удалям пулю не походя до края экрана
      this.markedForDeletion = true;
      this.game.ammo--;
    }
  }
  draw(context: CanvasRenderingContext2D) {
    //context.strokeRect(this.x,this.y,this.width, this.height)
    context.drawImage(this.image, this.x, this.y)
  }
}