/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {Game} from './Game'
export class Enemy {
  game: Game;
  x: number;
  speedX: number;
  markedForDeletion: boolean
  frameX: number
  frameY: number
  maxFrame: number;
  frame: number;
  liveProgress: number;
  constructor(game: Game) {
    this.game = game;
    this.x = this.game.width;
    this.speedX = Math.random() * -1.5 - 0.5;
    this.markedForDeletion = false;
    this.frameX = 0
    this.frameY = 0
    this.frame = -1
    this.maxFrame = 12;
    this.liveProgress = 50;
  }
  update(width: number) {
    this.x += this.speedX;
    if(this.x + width < 0) {
      this.markedForDeletion = true
    }
    //animation
    if(this.frameX < this.maxFrame) {
       this.frameX++
    }else {
       this.frameX =0
    }
  }
  draw(context: CanvasRenderingContext2D,  image: HTMLImageElement , y: number, width: number, height: number, lives: number, score: number) {
  //  console.log(image)
    //context.strokeRect(this.x, y, width /2, height/2)
    context.drawImage(
      image, 
      this.frameX * width, 
      0,
      width,
      height, 
      this.x, 
      y, 
      width /2, 
      height /2
    )
    // context.fillStyle = 'black'
    // context.font = '20px Helvetica'
    // context.fillText(`${lives}`, this.x, y)

    context.fillStyle = '#000';
    context.strokeRect(this.x,y + 10, 50, 10);
    context.fillStyle = '#48BF53'
    context.fillRect(this.x, y + 10, ( 50  * lives)/ score , 10)
  }
}

//do waving movment
export class Angler1 extends Enemy {
  width: number
  height: number
  y:number
  image: HTMLImageElement
  frameY: number;
  lives: number
  score: number
  angle: number;
  angleSpeed: number;
  imageLoad: boolean;
  curve: number
  constructor(game: Game) {
    super(game)
    this.imageLoad = false;
    this.width = 273
    this.height = 282
    this.angle = 0
    this.angleSpeed = Math.random() * 0.2
    this.y = Math.random() * (this.game.height * 0.9 - this.height)
    this.image = new Image(this.width, this.height)
    this.frameY = Math.floor(Math.random() * 2)
    this.lives = Math.floor(Math.random() * 5 + 1);
    this.score = this.lives
    this.curve = Math.random() * 1;
    this.image.src = './catalog-img/enemy-3.png'
  }
  update(){
    super.update(this.width)
    this.y += this.curve * Math.sin(this.angle); //движение по синусу
    this.angle +=this.angleSpeed;
  }
  draw(context: CanvasRenderingContext2D): void {
    super.draw(context, this.image, this.y, this.width, this.height, this.lives, this.score)
  }
}

// class Angler2 extends Enemy {
//   width: number
//   height: number
//   y:number
//   image:  CanvasImageSource;
//   frameY: number;
//   lives: number
//   score: number
//   constructor(game: Game) {
//     super(game)
//     this.width = 213;
//     this.height = 165;
//     this.y = Math.random() * (this.game.height * 0.9 - this.height)
//     this.image = new Image(this.width, this.height);
//     this.image.src ='./catalog-img/enemy2.png'
//     this.frameY = Math.floor(Math.random() * 2)
//     this.lives = 3;
//     this.score = this.lives
//   }
// }
// class Lucky extends Enemy {
//   width: number;
//   height:number;
//   y:number
//   image:CanvasImageSource;
//   frameY:number
//   lives:number
//   score:number;
//   type: string;
//   constructor(game: Game) {
//     super(game)
//     this.width = 99;
//     this.height = 95;
//     this.y = Math.random() * (this.game.height * 0.9 - this.height)
//     this.image = new Image(this.width, this.height);
//     this.image.src ='./catalog-img/enemy2.png'
//     this.frameY = Math.floor(Math.random() * 2)
//     this.lives = 3;
//     this.score = 15;
//     this.type = 'lucky'
//   }
// }

// const loadImage = (url: string) => {
//   return new Promise((resolve, reject) => {
//     const img = new Image();
//     img.src = url;
//     img.onload = () => resolve(img);
//     img.onerror = () => reject(new Error(`load ${url} fail`));
//   });
// };
