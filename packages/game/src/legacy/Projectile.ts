import {Game} from './Game'
export class Projectile {
  game: Game;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  markedForDeletion: boolean;
  image: CanvasImageSource;
  constructor(game: Game, x: number,y:number) {
    this.game = game;
    this.x = x;
    this.y = y;
    this.width = 10;
    this.height = 3;
    this.speed = 3;
    this.markedForDeletion = false;
    this.image = new Image(this.width, this.height);
    this.image.src = './catalog-img/projectile.png'
  }
  update() {
    this.x += this.speed;
    if(this.x > this.game.width * 0.8){  //удалям пулю не походя до края экрана
      this.markedForDeletion = true;
      this.game.ammo--;
    }
  }
  draw(context: CanvasRenderingContext2D) {
    context.drawImage(this.image, this.x, this.y)
  }
}