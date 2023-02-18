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
  constructor(game: Game) {
    this.game = game;
    this.x = this.game.width;
    this.speedX = Math.random() * -1.5 - 0.5;
    this.markedForDeletion = false;
    this.frameX = 0
    this.frameY = 0
    this.maxFrame = 5;
    this.frame = 0
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
  draw(context: CanvasRenderingContext2D,  image: CanvasImageSource, y: number, width: number, height: number,) {
    context.fillStyle = 'white'
    context.strokeRect(this.x, y, width /2, height/2)
    context.drawImage(
      image, 
      this.frameX * width, 
      this.frameY * height,
      width,
      height, 
      this.x, 
      y, 
      width /2, 
      height /2
    )
    context.fillStyle = 'black'
    context.font = '20px Helvetica'
    context.fillText('2', this.x, y)
  }
}

//do waving movment
export class Angler1 extends Enemy {
  width: number
  height: number
  y:number
  image:  CanvasImageSource;
  frameY: number;
  lives: number
  score: number
  angle: number;
  angleSpeed: number;
  // spriteWidth: number;
  // spriteHeight: number;
  curve: number
  constructor(game: Game) {
    super(game)
    this.width = 266
    //  this.width = 228
    // this.height = 169
     this.height = 188
    // this.spriteWidth = 266;
    // this.spriteHeight = 188;
    // this.width = this.spriteWidth / 2; 
    // this.height = this.spriteHeight / 2; 
    this.angle = 0
    this.angleSpeed = Math.random() * 0.2
    this.y = Math.random() * (this.game.height * 0.9 - this.height)
  //  loadImage('./catalog-img/enemy2.png') as CanvasImageSource;;
  //  this.image = new Image(this.width, this.height);
    //this.image.src ='./catalog-img/enemy2.png'
    this.image = document.querySelector('.angler1') as CanvasImageSource;
    this.frameY = Math.floor(Math.random() * 3)
    this.lives = 2;
    this.score = this.lives
    this.curve = Math.random() * 5;
  }
  update(){
    super.update(this.width)
    this.y += this.curve * Math.sin(this.angle); //движение по синусу
    this.angle +=this.angleSpeed;
  }
  draw(context: CanvasRenderingContext2D): void {
    context.fillStyle = 'white'
    super.draw(context, this.image, this.y, this.width, this.height)
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
